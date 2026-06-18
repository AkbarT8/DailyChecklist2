import api from './client';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export const usersApi = {
  getAll: () => api.get<User[]>('/users').then((r) => r.data),
  getOne: (id: string) => api.get<User>(`/users/${id}`).then((r) => r.data),
  create: (data: CreateUserDto) => api.post<User>('/users', data).then((r) => r.data),
  update: (id: string, data: UpdateUserDto) => api.patch<User>(`/users/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/users/${id}`),
};

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get<LoginResponse['user']>('/auth/me').then((r) => r.data),
};
