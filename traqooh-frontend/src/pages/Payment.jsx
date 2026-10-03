import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, Lock, CheckCircle, AlertCircle, Building2, Smartphone, Wallet, ArrowLeft } from 'lucide-react';

const PLANS = {
    starter: { name: 'Starter Plan', price: 2999, description: 'Monthly subscription - Up to 10 listings' },
    professional: { name: 'Professional Plan', price: 7999, description: 'Monthly subscription - Up to 50 listings' },
    enterprise: { name: 'Enterprise Plan', price: 19999, description: 'Monthly subscription - Unlimited listings' },
};

export default function Payment() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const planId = searchParams.get('plan');

    const [paymentMethod, setPaymentMethod] = useState('card');
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const [cardData, setCardData] = useState({
        number: '',
        name: '',
        expiry: '',
        cvv: '',
    });

    const [upiId, setUpiId] = useState('');

    // Dynamic order based on plan or default
    const order = useMemo(() => {
        if (planId && PLANS[planId]) {
            const plan = PLANS[planId];
            const gst = Math.round(plan.price * 0.18);
            return {
                id: 'ORD-' + Date.now(),
                amount: plan.price,
                description: plan.description,
                planName: plan.name,
                duration: '1 Month',
                gst: gst,
                total: plan.price + gst,
            };
        }
        // Default order for billboard booking
        return {
            id: 'ORD-' + Date.now(),
            amount: 25000,
            description: 'Billboard Booking - Mumbai Central',
            planName: 'Billboard Booking',
            duration: '30 days',
            gst: 4500,
            total: 29500,
        };
    }, [planId]);

    const formatCardNumber = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        return parts.length ? parts.join(' ') : value;
    };

    const formatExpiry = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        if (v.length >= 2) {
            return v.substring(0, 2) + '/' + v.substring(2, 4);
        }
        return v;
    };

    const handleCardChange = (e) => {
        const { name, value } = e.target;
        if (name === 'number') {
            setCardData({ ...cardData, number: formatCardNumber(value) });
        } else if (name === 'expiry') {
            setCardData({ ...cardData, expiry: formatExpiry(value) });
        } else if (name === 'cvv') {
            setCardData({ ...cardData, cvv: value.replace(/[^0-9]/g, '').substring(0, 3) });
        } else {
            setCardData({ ...cardData, [name]: value });
        }
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        setError('');
        setProcessing(true);

        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Simulate success (90% success rate for demo)
        if (Math.random() > 0.1) {
            setSuccess(true);
        } else {
            setError('Payment failed. Please try again.');
            setProcessing(false);
        }
    };

    if (success) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-[#153477] via-[#1f3988] to-[#3c238f] flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
                    <p className="text-gray-600 mb-6">Your booking has been confirmed.</p>

                    <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-600">Order ID</span>
                            <span className="font-semibold text-gray-800">{order.id}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-600">Amount Paid</span>
                            <span className="font-semibold text-green-600">₹{order.total.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Payment Method</span>
                            <span className="font-semibold text-gray-800 capitalize">{paymentMethod}</span>
                        </div>
                    </div>

                    <p className="text-sm text-gray-500 mb-6">
                        A confirmation email has been sent to your registered email address.
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex-1 py-3 bg-[#1f3c8f] text-white font-semibold rounded-xl hover:bg-[#153477] transition"
                        >
                            Go to Dashboard
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
                        >
                            Print
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-[#153477] via-[#1f3988] to-[#3c238f] py-10 px-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/dashboard" className="text-white/80 hover:text-white transition">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Secure Payment</h1>
                        <p className="text-white/70">Complete your booking</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2 text-green-400">
                        <Lock className="w-4 h-4" />
                        <span className="text-sm">256-bit SSL Encrypted</span>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* Payment Form */}
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-2xl p-6 shadow-xl">
                            {/* Payment Method Tabs */}
                            <div className="flex gap-2 mb-6">
                                <button
                                    onClick={() => setPaymentMethod('card')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition ${paymentMethod === 'card'
                                        ? 'bg-[#1f3c8f] text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <CreditCard className="w-5 h-5" />
                                    Card
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('upi')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition ${paymentMethod === 'upi'
                                        ? 'bg-[#1f3c8f] text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <Smartphone className="w-5 h-5" />
                                    UPI
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('netbanking')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition ${paymentMethod === 'netbanking'
                                        ? 'bg-[#1f3c8f] text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <Building2 className="w-5 h-5" />
                                    NetBanking
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('wallet')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition ${paymentMethod === 'wallet'
                                        ? 'bg-[#1f3c8f] text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <Wallet className="w-5 h-5" />
                                    Wallet
                                </button>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-red-700">
                                    <AlertCircle className="w-5 h-5" />
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handlePayment}>
                                {/* Card Payment */}
                                {paymentMethod === 'card' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    name="number"
                                                    value={cardData.number}
                                                    onChange={handleCardChange}
                                                    placeholder="1234 5678 9012 3456"
                                                    maxLength={19}
                                                    required
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                />
                                                <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={cardData.name}
                                                onChange={handleCardChange}
                                                placeholder="John Doe"
                                                required
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                                                <input
                                                    type="text"
                                                    name="expiry"
                                                    value={cardData.expiry}
                                                    onChange={handleCardChange}
                                                    placeholder="MM/YY"
                                                    maxLength={5}
                                                    required
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                                                <input
                                                    type="password"
                                                    name="cvv"
                                                    value={cardData.cvv}
                                                    onChange={handleCardChange}
                                                    placeholder="•••"
                                                    maxLength={3}
                                                    required
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* UPI Payment */}
                                {paymentMethod === 'upi' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID</label>
                                            <input
                                                type="text"
                                                value={upiId}
                                                onChange={(e) => setUpiId(e.target.value)}
                                                placeholder="yourname@upi"
                                                required
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                            />
                                        </div>
                                        <div className="flex gap-3 flex-wrap">
                                            {['Google Pay', 'PhonePe', 'Paytm', 'BHIM'].map((app) => (
                                                <button
                                                    key={app}
                                                    type="button"
                                                    className="px-4 py-2 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-sm"
                                                >
                                                    {app}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* NetBanking */}
                                {paymentMethod === 'netbanking' && (
                                    <div className="space-y-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Bank</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak', 'Yes Bank'].map((bank) => (
                                                <button
                                                    key={bank}
                                                    type="button"
                                                    className="px-4 py-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-sm font-medium"
                                                >
                                                    {bank}
                                                </button>
                                            ))}
                                        </div>
                                        <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                            <option value="">Other Banks...</option>
                                            <option value="pnb">Punjab National Bank</option>
                                            <option value="bob">Bank of Baroda</option>
                                            <option value="canara">Canara Bank</option>
                                        </select>
                                    </div>
                                )}

                                {/* Wallet */}
                                {paymentMethod === 'wallet' && (
                                    <div className="space-y-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Wallet</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {['Paytm', 'PhonePe', 'Amazon Pay', 'Mobikwik', 'Freecharge', 'Airtel Money'].map((wallet) => (
                                                <button
                                                    key={wallet}
                                                    type="button"
                                                    className="px-4 py-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-sm font-medium"
                                                >
                                                    {wallet}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Pay Button */}
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className={`w-full mt-6 py-4 rounded-xl font-bold text-white text-lg transition ${processing
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-[#1f3c8f] to-[#3b5cc8] hover:opacity-90'
                                        }`}
                                >
                                    {processing ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Processing...
                                        </span>
                                    ) : (
                                        `Pay ₹${order.total.toLocaleString()}`
                                    )}
                                </button>
                            </form>

                            {/* Security Badges */}
                            <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t">
                                <div className="text-center">
                                    <div className="text-xs text-gray-500">Secured by</div>
                                    <div className="font-semibold text-gray-700">RazorPay</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs text-gray-500">PCI DSS</div>
                                    <div className="font-semibold text-gray-700">Compliant</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs text-gray-500">100%</div>
                                    <div className="font-semibold text-gray-700">Safe & Secure</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Order Summary */}
                    <div>
                        <div className="bg-white rounded-2xl p-6 shadow-xl sticky top-6">
                            <h2 className="text-lg font-bold text-gray-800 mb-4">Order Summary</h2>

                            <div className="space-y-3 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Order ID</span>
                                    <span className="font-medium">{order.id}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Description</span>
                                    <span className="font-medium text-right">{order.description}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Duration</span>
                                    <span className="font-medium">{order.duration}</span>
                                </div>
                            </div>

                            <hr className="my-4" />

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal</span>
                                    <span>₹{order.amount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">GST (18%)</span>
                                    <span>₹{order.gst.toLocaleString()}</span>
                                </div>
                            </div>

                            <hr className="my-4" />

                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold text-gray-800">Total</span>
                                <span className="text-2xl font-bold text-[#1f3c8f]">₹{order.total.toLocaleString()}</span>
                            </div>

                            <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                                <p className="text-xs text-blue-700">
                                    <strong>Note:</strong> This is a demo payment page. No actual transactions will be processed.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
