import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="dashboard-header-actions">
          <span>{user?.email}</span>
          <button type="button" onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <div className="dashboard-content">
        <div className="welcome-card">
          <h2>Welcome, {user?.firstName}!</h2>
          <p>You are successfully logged in.</p>
          <div className="user-details">
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Role:</strong> {user?.role}</p>
          </div>
          <div className="dashboard-actions">
            <Link to="/users" className="dashboard-link">
              Manage Users →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
