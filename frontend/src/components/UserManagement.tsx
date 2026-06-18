import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateUserDto, UpdateUserDto, User, usersApi } from '../api/users';
import './UserManagement.css';

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<CreateUserDto>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'user',
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserDto) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserDto }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const resetForm = () => {
    setFormData({ email: '', password: '', firstName: '', lastName: '', role: 'user' });
  };

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        password: '',
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    } else {
      setEditingUser(null);
      resetForm();
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    resetForm();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const data: UpdateUserDto = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
      };
      if (formData.password) data.password = formData.password;
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this user?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="loading_pls">Loading users...</div>;
  }

  return (
    <div className="user-management">
      <div className="user-management-top">
        <Link to="/dashboard" className="back-link">← Dashboard</Link>
      </div>
      <div className="user-management-header">
        <h1>User Management</h1>
        <button type="button" className="btn-primary" onClick={() => openModal()}>
          + Add User
        </button>
      </div>

      <div className="users-list">
        {users && users.length > 0 ? (
          users.map((user) => (
            <div key={user.id} className="user-card">
              <div className="user-info">
                <div className="user-avatar">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div className="user-details">
                  <div className="user-name">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="user-email">{user.email}</div>
                  <div className="user-role">Role: {user.role}</div>
                </div>
              </div>
              <div className="user-actions">
                <button type="button" className="action-btn edit-btn" onClick={() => openModal(user)} title="Edit">
                  Edit
                </button>
                <button type="button" className="action-btn delete-btn" onClick={() => handleDelete(user.id)} title="Delete">
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>No users found. Create your first user.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingUser ? 'Edit User' : 'Create User'}</h2>
              <button type="button" className="close-btn" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">
                  Password {editingUser && '(leave empty to keep current)'}
                </label>
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
