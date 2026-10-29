export type Role = 'ADMIN' | 'INSPECTOR' | 'VIEWER';
export type InspectionStatus = 'DRAFT' | 'IN_PROGRESS' | 'ACTION_REQUIRED' | 'COMPLETED';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
}

export interface Observation {
  id: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  remedialAction: string;
}

export interface Inspection {
  id: string;
  building: string;
  location: string;
  notes: string;
  status: InspectionStatus;
  inspectorId: string;
  inspectorName: string;
  observations: Observation[];
  photos: string[];
  aiSummary?: string;
  createdAt: string;
  updatedAt: string;
}
