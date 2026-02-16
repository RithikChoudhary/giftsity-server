import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext();

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      // Disconnect if user logs out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const token = localStorage.getItem('giftsity_token');
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected');
    });

    newSocket.on('notification', (data) => {
      setUnreadNotifications(prev => prev + 1);
      // Show toast for important notifications
      if (data.type !== 'new_message') {
        toast(data.title, { icon: '🔔', duration: 4000 });
      }
    });

    newSocket.on('newMessage', () => {
      setUnreadMessages(prev => prev + 1);
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const resetUnreadNotifications = () => setUnreadNotifications(0);
  const resetUnreadMessages = () => setUnreadMessages(0);

  return (
    <SocketContext.Provider value={{
      socket,
      unreadNotifications,
      setUnreadNotifications,
      resetUnreadNotifications,
      unreadMessages,
      setUnreadMessages,
      resetUnreadMessages
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
