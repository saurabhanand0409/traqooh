import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Star, Zap, Crown, ArrowRight } from 'lucide-react';
import Chatbot from '../components/Chatbot';

const plans = [
    {
        id: 'starter',
        name: 'Starter',
        price: 2999,
        description: 'Perfect for small media owners getting started',
        icon: Star,
        color: 'from-blue-500 to-blue-600',
        features: [
            'Up to 10 billboard listings',
            'Basic analytics dashboard',
            'Email support',
            'Standard visibility',
            'Monthly reports',
        ],
        notIncluded: [
            'Priority support',
            'Advanced analytics',
            'API access',
        ],
    },
    {
        id: 'professional',
        name: 'Professional',
        price: 7999,
        description: 'Best for growing media businesses',
        icon: Zap,
        color: 'from-purple-500 to-purple-600',
        popular: true,
        features: [
            'Up to 50 billboard listings',
            'Advanced analytics dashboard',
            'Priority email & chat support',
            'Featured listings',
            'Weekly reports',
            'Campaign insights',
            'Competitor analysis',
        ],
        notIncluded: [
            'API access',
            'White-label options',
        ],
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 19999,
        description: 'For large media owners with premium needs',
        icon: Crown,
        color: 'from-amber-500 to-orange-600',
        features: [
            'Unlimited billboard listings',
            'Real-time analytics',
            'Dedicated account manager',
            'Premium visibility & placement',
            'Daily reports',
            'API access',
            'White-label dashboard',
            'Custom integrations',
            'SLA guarantee',
        ],
        notIncluded: [],
    },
];

export default function Pricing() {
    const navigate = useNavigate();

    const handleSelectPlan = (planId) => {
        // Check if user is logged in (check localStorage)
        const user = localStorage.getItem('user');
        if (user) {
            // User is logged in, go to payment
            navigate(`/payment?plan=${planId}`);
        } else {
            // Not logged in, redirect to login with return URL
            navigate(`/media-owner?redirect=/payment?plan=${planId}`);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-[#153477] via-[#1f3988] to-[#3c238f]">
            {/* Header */}
            <header className="py-6 px-6 border-b border-white/10">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <Link to="/" className="flex items-center gap-2 text-white">
                        <div className="h-10 w-10 rounded-lg bg-white/10 grid place-items-center border border-white/15">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.6" />
                            </svg>
                        </div>
                        <span className="text-xl font-bold">TraqOOH</span>
                    </Link>
                    <nav className="flex gap-6 items-center">
                        <Link to="/" className="text-white/80 hover:text-white transition">Home</Link>
                        <Link to="/contact" className="text-white/80 hover:text-white transition">Contact</Link>
                        <Link
                            to="/media-owner"
                            className="px-4 py-2 bg-white text-[#1f3c8f] rounded-lg font-semibold hover:bg-white/90 transition"
                        >
                            Login
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Hero */}
            <section className="py-16 px-6 text-center text-white">
                <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
                    Simple, Transparent Pricing
                </h1>
                <p className="text-xl text-white/80 max-w-2xl mx-auto">
                    Choose the perfect plan for your business. All plans include a 14-day free trial.
                </p>
            </section>

            {/* Pricing Cards */}
            <section className="px-6 pb-20">
                <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 items-stretch">
                    {plans.map((plan) => {
                        const IconComponent = plan.icon;
                        return (
                            <div
                                key={plan.id}
                                className={`relative bg-white rounded-2xl p-8 shadow-xl flex flex-col transition-all duration-300 ease-out hover:scale-105 hover:shadow-2xl hover:-translate-y-2 cursor-pointer ${plan.popular ? 'ring-4 ring-purple-400' : 'hover:ring-2 hover:ring-blue-300'
                                    }`}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-bold rounded-full">
                                        Most Popular
                                    </div>
                                )}

                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${plan.color} flex items-center justify-center mb-6`}>
                                    <IconComponent className="w-7 h-7 text-white" />
                                </div>

                                <h3 className="text-2xl font-bold text-gray-800 mb-2">{plan.name}</h3>
                                <p className="text-gray-600 mb-4">{plan.description}</p>

                                <div className="mb-6">
                                    <span className="text-4xl font-extrabold text-gray-800">₹{plan.price.toLocaleString()}</span>
                                    <span className="text-gray-500">/month</span>
                                </div>

                                <button
                                    onClick={() => handleSelectPlan(plan.id)}
                                    className={`w-full py-3 rounded-xl font-bold text-white mb-6 transition-all duration-200 flex items-center justify-center gap-2 ${plan.popular
                                            ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 hover:shadow-lg'
                                            : 'bg-gradient-to-r from-[#1f3c8f] to-[#3b5cc8] hover:from-[#153477] hover:to-[#1f3c8f] hover:shadow-lg'
                                        }`}
                                >
                                    Get Started <ArrowRight className="w-4 h-4" />
                                </button>

                                <div className="space-y-3 flex-grow">
                                    {plan.features.map((feature, idx) => (
                                        <div key={idx} className="flex items-start gap-3">
                                            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-gray-700">{feature}</span>
                                        </div>
                                    ))}
                                    {plan.notIncluded.map((feature, idx) => (
                                        <div key={idx} className="flex items-start gap-3 opacity-50">
                                            <span className="w-5 h-5 flex items-center justify-center text-gray-400">✕</span>
                                            <span className="text-gray-500 line-through">{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* FAQ Section */}
            <section className="px-6 pb-20">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-white text-center mb-10">Frequently Asked Questions</h2>

                    <div className="space-y-4">
                        {[
                            {
                                q: 'Can I change my plan later?',
                                a: 'Yes! You can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.',
                            },
                            {
                                q: 'What payment methods do you accept?',
                                a: 'We accept all major credit/debit cards, UPI, NetBanking, and popular wallets like Paytm, PhonePe, and Google Pay.',
                            },
                            {
                                q: 'Is there a free trial?',
                                a: 'Yes, all plans come with a 14-day free trial. No credit card required to start.',
                            },
                            {
                                q: 'Can I cancel anytime?',
                                a: 'Absolutely. You can cancel your subscription at any time with no questions asked.',
                            },
                        ].map((faq, idx) => (
                            <div key={idx} className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10">
                                <h3 className="text-lg font-semibold text-white mb-2">{faq.q}</h3>
                                <p className="text-white/70">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="px-6 pb-20 text-center">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-3xl font-bold text-white mb-4">Still have questions?</h2>
                    <p className="text-white/80 mb-6">Contact our sales team for a personalized demo and custom pricing.</p>
                    <Link
                        to="/contact"
                        className="inline-flex items-center gap-2 px-8 py-3 bg-white text-[#1f3c8f] rounded-xl font-bold hover:bg-white/90 transition"
                    >
                        Contact Sales
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-white/10 text-center">
                <p className="text-white/60">© 2024 TraqOOH. All rights reserved.</p>
            </footer>

            <Chatbot />
        </main>
    );
}
