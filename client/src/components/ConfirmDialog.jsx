import { useState, createContext, useContext, useCallback } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback(({ title, message, confirmText = 'Ya', cancelText = 'Batal', variant = 'primary' }) => {
    return new Promise((resolve) => {
      setDialog({ title, message, confirmText, cancelText, variant, resolve });
    });
  }, []);

  const handleClose = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  const btnColors = {
    primary: 'bg-primary hover:bg-primary-dark text-white',
    danger: 'bg-danger hover:bg-red-700 text-white',
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => handleClose(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{dialog.title}</h3>
            <p className="text-sm text-gray-600 mb-6">{dialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {dialog.cancelText}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${btnColors[dialog.variant]}`}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be inside ConfirmProvider');
  return ctx;
}
