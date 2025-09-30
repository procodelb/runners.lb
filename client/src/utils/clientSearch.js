import api from '../api';

// Search clients for autocomplete functionality
export const searchClients = async (query) => {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const response = await api.get(`/clients/search/${encodeURIComponent(query)}`);
    return response.data?.data || [];
  } catch (error) {
    console.error('Error searching clients:', error);
    return [];
  }
};

// Format client data for autocomplete display
export const formatClientForAutocomplete = (client) => {
  return {
    id: client.id,
    value: client.business_name,
    label: `${client.business_name}${client.contact_person ? ` - ${client.contact_person}` : ''}`,
    business_name: client.business_name,
    contact_person: client.contact_person,
    phone: client.phone,
    address: client.address,
    instagram: client.instagram,
    website: client.website,
    google_location: client.google_location,
    category: client.category
  };
};

// Get client by ID for order creation
export const getClientById = async (id) => {
  try {
    const response = await api.get(`/clients/${id}`);
    return response.data?.data;
  } catch (error) {
    console.error('Error fetching client:', error);
    return null;
  }
};
