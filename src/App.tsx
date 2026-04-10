import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import AddItem from '@/pages/AddItem';
import Catalog from '@/pages/Catalog';
import Collection from '@/pages/Collection';
import ItemDetail from '@/pages/ItemDetail';
import Settings from '@/pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add" element={<AddItem />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/collection/:id" element={<ItemDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Page not found</h2>
      <p className="text-sm text-gray-500">The page you're looking for doesn't exist.</p>
    </div>
  );
}
