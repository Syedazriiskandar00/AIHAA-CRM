import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Import from './pages/Import';
import Export from './pages/Export';

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Router>
          <div className="flex h-screen bg-bg">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <div className="p-4 lg:p-8 pt-16 lg:pt-8">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/import" element={<Import />} />
                  <Route path="/export" element={<Export />} />
                </Routes>
              </div>
            </main>
          </div>
        </Router>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
