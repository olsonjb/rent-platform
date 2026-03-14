import { createProperty } from '@/app/actions/properties';
import Link from 'next/link';

export default function NewPropertyPage() {
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-4">
        <Link href="/protected/properties" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">Add Property</h1>
      </div>

      <form action={createProperty} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">Property Name</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g. Maple Ridge Apartments"
            className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="address" className="text-sm font-medium">Street Address</label>
          <input
            id="address"
            name="address"
            type="text"
            required
            className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="city" className="text-sm font-medium">City</label>
            <input
              id="city"
              name="city"
              type="text"
              required
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="state" className="text-sm font-medium">State</label>
            <input
              id="state"
              name="state"
              type="text"
              required
              maxLength={2}
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="zip" className="text-sm font-medium">ZIP Code</label>
          <input
            id="zip"
            name="zip"
            type="text"
            required
            className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="rent_due_day" className="text-sm font-medium">Rent Due Day</label>
          <input
            id="rent_due_day"
            name="rent_due_day"
            type="number"
            required
            min="1"
            max="28"
            defaultValue="1"
            className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="bedrooms" className="text-sm font-medium">Bedrooms</label>
            <input
              id="bedrooms"
              name="bedrooms"
              type="number"
              required
              min="0"
              defaultValue="1"
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="bathrooms" className="text-sm font-medium">Bathrooms</label>
            <input
              id="bathrooms"
              name="bathrooms"
              type="number"
              required
              min="0"
              step="0.5"
              defaultValue="1"
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="monthly_rent" className="text-sm font-medium">Monthly Rent ($)</label>
            <input
              id="monthly_rent"
              name="monthly_rent"
              type="number"
              required
              min="0"
              step="0.01"
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <button
          type="submit"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors mt-2"
        >
          Save Property
        </button>
      </form>
    </div>
  );
}
