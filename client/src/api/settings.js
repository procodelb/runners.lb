import api from './index';

export const settingsApi = {
  // Get user profile
  getProfile: async () => {
    const response = await api.get('/settings/profile');
    return response.data;
  },

  // Update user profile
  updateProfile: async (profileData) => {
    const response = await api.put('/settings/profile', profileData);
    return response.data;
  },

  // Change password
  changePassword: async (passwordData) => {
    const response = await api.put('/settings/password', passwordData);
    return response.data;
  },

  // Get user preferences
  getPreferences: async () => {
    const response = await api.get('/settings');
    return response.data;
  },

  // Update user preferences
  updatePreferences: async (preferences) => {
    const response = await api.put('/settings', preferences);
    return response.data;
  },

  // Get system settings
  getSystemSettings: async () => {
    const response = await api.get('/settings/system');
    return response.data;
  },

  // Update system settings
  updateSystemSettings: async (settings) => {
    const response = await api.put('/settings/system', settings);
    return response.data;
  },

  // Export user data
  exportUserData: async () => {
    const response = await api.get('/settings/export', {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get available languages
  getLanguages: async () => {
    const response = await api.get('/settings/languages');
    return response.data;
  },

  // Get available themes
  getThemes: async () => {
    const response = await api.get('/settings/themes');
    return response.data;
  },

  // Get notification settings
  getNotificationSettings: async () => {
    const response = await api.get('/settings/notifications');
    return response.data;
  },

  // Update notification settings
  updateNotificationSettings: async (settings) => {
    const response = await api.put('/settings/notifications', settings);
    return response.data;
  }
};
