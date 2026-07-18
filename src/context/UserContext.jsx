import { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [profile, setProfile] = useState({
    userName: '',
    phone: '',
    userScore: null,
    isRegistered: false,
  });

  function register({ userName, phone, userScore }) {
    setProfile({ userName, phone, userScore: userScore ?? null, isRegistered: true });
  }

  return (
    <UserContext.Provider value={{ profile, register }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
