export interface Organization {
  id: number;
  name: string;
  type: string | null;
  slug: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  created_at: string;
}

export interface Master {
  id: number;
  organization_id: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Service {
  id: number;
  organization_id: number;
  master_id: number;
  name: string;
  duration_min: number;
  price: number | null;
  is_active: boolean;
  created_at: string;
}

export interface WorkingHour {
  id: number;
  master_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export type BookingStatus = "confirmed" | "pending" | "cancelled";

export interface Booking {
  id: number;
  organization_id: number | null;
  master_id: number;
  service_id?: number;
  client_name: string;
  client_phone: string;
  client_email?: string;
  service_type: string;
  start_time: string;
  slot_time: string;
  end_time: string;
  status: BookingStatus;
  cancelled_at?: string | null;
  created_at: string;
}

export interface ApiError {
  error: string;
}

export interface MasterResponse {
  organization: Organization;
  master: Master;
}

export interface ServicesResponse {
  services: Service[];
}

export interface WorkingHoursResponse {
  workingHours: WorkingHour[];
}

export interface AvailableSlot {
  time: string;
  available: boolean;
}

export interface AvailableSlotsResponse {
  slots: AvailableSlot[];
}

export interface CreateBookingRequest {
  masterId: number;
  serviceId: number;
  clientName: string;
  clientPhone: string;
  slotTime: string;
}

export interface CreateBookingResponse {
  booking: Booking;
}
