'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { LeaseDocument, ExtractedLeaseData } from '@/lib/types';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function uploadLeaseDocument(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const file = formData.get('file') as File | null;
  if (!file) throw new Error('No file provided');

  // Validate PDF type
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are accepted');
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 20MB limit');
  }

  // Upload to Supabase Storage
  const fileName = `${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('lease-documents')
    .upload(fileName, file, { contentType: 'application/pdf' });

  if (uploadError) {
    throw new Error('Failed to upload file');
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('lease-documents')
    .getPublicUrl(fileName);

  // Create lease_documents record (DB trigger will enqueue extraction job)
  const { data: doc, error: insertError } = await supabase
    .from('lease_documents')
    .insert({
      landlord_id: user.id,
      file_url: urlData.publicUrl,
      file_name: file.name,
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error('Failed to create document record');
  }

  revalidatePath('/landlord/documents');
  redirect(`/landlord/documents/${doc.id}/review`);
}

export async function getLeaseDocument(documentId: string): Promise<LeaseDocument | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data, error } = await supabase
    .from('lease_documents')
    .select('*')
    .eq('id', documentId)
    .eq('landlord_id', user.id)
    .single();

  if (error) return null;
  return data as LeaseDocument;
}

export async function getLeaseDocuments(): Promise<LeaseDocument[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data, error } = await supabase
    .from('lease_documents')
    .select('*')
    .eq('landlord_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as LeaseDocument[];
}

export async function confirmExtraction(documentId: string, editedData: ExtractedLeaseData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Verify ownership
  const { data: doc, error: docError } = await supabase
    .from('lease_documents')
    .select('id, landlord_id')
    .eq('id', documentId)
    .eq('landlord_id', user.id)
    .single();

  if (docError || !doc) {
    throw new Error('Document not found');
  }

  // Create or update property from extracted data
  const propertyInsert: Record<string, unknown> = {
    landlord_id: user.id,
    name: editedData.address.street ?? 'Untitled Property',
    address: editedData.address.street ?? '',
    city: editedData.address.city,
    state: editedData.address.state,
    zip: editedData.address.zip,
    pet_policy: editedData.pet_policy,
    parking_policy: editedData.parking_policy,
    quiet_hours: editedData.quiet_hours,
  };

  if (editedData.monthly_rent != null) {
    propertyInsert.monthly_rent = editedData.monthly_rent;
  }

  if (editedData.contact_info.name) {
    propertyInsert.manager_name = editedData.contact_info.name;
  }
  if (editedData.contact_info.phone) {
    propertyInsert.manager_phone = editedData.contact_info.phone;
  }

  const { data: property, error: propError } = await supabase
    .from('properties')
    .insert(propertyInsert)
    .select('id')
    .single();

  if (propError) {
    throw new Error('Failed to create property record');
  }

  // Create lease record if we have dates
  if (editedData.lease_start_date && editedData.lease_end_date) {
    // Try to find matching tenant
    let tenantId: string | null = null;
    if (editedData.tenant_names.length > 0) {
      const { data: tenant } = await supabase
        .from('landlord_tenants')
        .select('id')
        .eq('landlord_id', user.id)
        .ilike('name', editedData.tenant_names[0])
        .maybeSingle();

      if (tenant) {
        tenantId = tenant.id;
      }
    }

    if (tenantId) {
      await supabase.from('leases').insert({
        landlord_id: user.id,
        property_id: property.id,
        tenant_id: tenantId,
        start_date: editedData.lease_start_date,
        end_date: editedData.lease_end_date,
        monthly_rent: editedData.monthly_rent ?? 0,
        status: 'active',
      });
    }
  }

  // Link document to property and clear extracted_data (PII)
  await supabase
    .from('lease_documents')
    .update({
      property_id: property.id,
      extracted_data: null,
      extraction_status: 'completed',
    })
    .eq('id', documentId);

  revalidatePath('/landlord/documents');
  revalidatePath('/protected/properties');
  redirect('/landlord/documents?confirmed=1');
}

export async function requestReExtraction(documentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Reset extraction status — DB trigger on insert won't fire,
  // so we manually create a new job
  const { error: updateError } = await supabase
    .from('lease_documents')
    .update({ extraction_status: 'pending', extracted_data: null })
    .eq('id', documentId)
    .eq('landlord_id', user.id);

  if (updateError) throw new Error('Failed to request re-extraction');

  // Enqueue new job manually
  await supabase.from('document_extraction_jobs').insert({
    document_id: documentId,
  });

  revalidatePath(`/landlord/documents/${documentId}/review`);
  redirect(`/landlord/documents/${documentId}/review`);
}
