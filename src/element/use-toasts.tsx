import { useRef, useState } from "react";
import { Toast, ToastContainer } from "react-bootstrap";

type ToastMsg = { id: number; text: string; variant: "success" | "danger" };

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const seq = useRef(0);

  const toast = (text: string, variant: ToastMsg["variant"]) => {
    const id = ++seq.current;
    setToasts(prev => [...prev, { id, text, variant }]);
  };

  const node = (
    <ToastContainer position="bottom-center" className="p-3" style={{ position: "fixed", zIndex: 2000 }}>
      {toasts.map(m => (
        <Toast
          key={m.id}
          bg={m.variant}
          autohide
          delay={m.variant === "danger" ? 4000 : 1200}
          onClose={() => setToasts(prev => prev.filter(x => x.id !== m.id))}
        >
          <Toast.Body className="text-white">{m.text}</Toast.Body>
        </Toast>
      ))}
    </ToastContainer>
  );

  return { toast, toastNode: node };
}
