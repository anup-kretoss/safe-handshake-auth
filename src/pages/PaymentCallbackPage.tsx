import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { verifyMamoPayment } from '@/lib/api';

type State = 'verifying' | 'success' | 'failed';

export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('verifying');
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    const status = searchParams.get('status');           // 'captured' | 'failed'
    const transactionId = searchParams.get('transactionId') || searchParams.get('transaction_id');
    const paymentLinkId = searchParams.get('paymentLinkId') || searchParams.get('payment_link_id');
    // order_id comes from our redirect_url query param (primary) or sessionStorage (fallback)
    const orderId = searchParams.get('order_id') || sessionStorage.getItem('pending_order_id');

    // If Mamo says failed upfront, no need to verify
    if (status === 'failed') {
      setState('failed');
      setMessage('Payment was declined. Please try again.');
      sessionStorage.removeItem('pending_order_id');
      return;
    }

    if (!orderId) {
      setState('failed');
      setMessage('Order not found. Please contact support.');
      return;
    }

    // Verify with our backend (which re-checks with Mamo)
    verifyMamoPayment({ order_id: orderId, transaction_id: transactionId || undefined, payment_link_id: paymentLinkId || undefined })
      .then(() => {
        setState('success');
        setMessage('Payment completed successfully.');
        sessionStorage.removeItem('pending_order_id');
        toast.success('Payment successful! Your order is confirmed.');
        setTimeout(() => navigate('/orders'), 2500);
      })
      .catch((err: any) => {
        setState('failed');
        setMessage(err.message || 'Payment verification failed.');
        sessionStorage.removeItem('pending_order_id');
      });
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 gap-6">
      {state === 'verifying' && (
        <>
          <Loader2 className="h-14 w-14 text-primary animate-spin" />
          <p className="text-lg font-semibold text-foreground">Verifying payment...</p>
          <p className="text-sm text-muted-foreground">Please wait, do not close this page.</p>
        </>
      )}

      {state === 'success' && (
        <>
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <p className="text-xl font-bold text-foreground">Payment Successful!</p>
          <p className="text-sm text-muted-foreground text-center">{message}</p>
          <p className="text-xs text-muted-foreground">Redirecting to your orders...</p>
        </>
      )}

      {state === 'failed' && (
        <>
          <XCircle className="h-16 w-16 text-destructive" />
          <p className="text-xl font-bold text-foreground">Payment Failed</p>
          <p className="text-sm text-muted-foreground text-center">{message}</p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary transition"
            >
              Go Back
            </button>
            <button
              onClick={() => navigate('/orders')}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition"
            >
              View Orders
            </button>
          </div>
        </>
      )}
    </div>
  );
}
