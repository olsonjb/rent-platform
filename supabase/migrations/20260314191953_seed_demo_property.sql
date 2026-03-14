insert into public.properties (id, name, address, rent_due_day, parking_policy, pet_policy, quiet_hours, lease_terms, manager_name, manager_phone)
values (
  'a0000000-0000-0000-0000-000000000001',
  'Maple Ridge Apartments',
  '1250 S State St, Salt Lake City, UT 84115',
  1,
  'One assigned spot per unit. Guest parking in Row G. No overnight guest parking without prior notice.',
  'Cats and small dogs under 25 lbs with $300 pet deposit. Max 2 pets.',
  '10 PM – 7 AM Sunday–Thursday, 11 PM – 8 AM Friday–Saturday',
  '12-month lease. Early termination fee: 2 months rent. Rent: $1,450/mo.',
  'Diana Torres',
  '(801) 555-0142'
)
on conflict (id) do nothing;
