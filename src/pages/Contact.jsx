import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Mail, Clock, Facebook, Twitter, Instagram, Linkedin, FileText, Send, CheckCircle } from 'lucide-react';
import Chatbot from '../components/Chatbot';

export default function Contact() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
    });
    const [submitted, setSubmitted] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // In production, send to backend
        console.log('Form submitted:', formData);
        setSubmitted(true);
        setTimeout(() => {
            setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
            setSubmitted(false);
        }, 3000);
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-[#153477] via-[#1f3988] to-[#3c238f] text-white">
            {/* Header */}
            <header className="py-6 px-6 border-b border-white/10">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <Link to="/get-started" className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-white/10 grid place-items-center border border-white/15">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.6" />
                                <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.6" />
                            </svg>
                        </div>
                        <span className="text-xl font-bold">TraqOOH</span>
                    </Link>
                    <nav className="flex gap-6">
                        <Link to="/get-started" className="text-white/80 hover:text-white transition">Home</Link>
                        <Link to="/contact" className="text-white font-semibold">Contact</Link>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <section className="py-16 px-6 text-center">
                <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Get in Touch</h1>
                <p className="text-lg text-white/85 max-w-2xl mx-auto">
                    Have questions about our OOH advertising platform? We're here to help. Reach out to us and we'll respond as soon as possible.
                </p>
            </section>

            {/* Contact Info & Form */}
            <section className="px-6 pb-20">
                <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">

                    {/* Contact Information */}
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Contact Information</h2>
                            <p className="text-white/80 mb-8">
                                Fill up the form and our team will get back to you within 24 hours.
                            </p>
                        </div>

                        {/* Contact Cards */}
                        <div className="space-y-6">
                            {/* HEAD OFFICE */}
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                                <div className="w-12 h-12 rounded-lg bg-[#ff6b2f] flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1 text-[#ff6b2f]">HEAD OFFICE</h3>
                                    <p className="text-white/80">103, P.V. Complex</p>
                                    <p className="text-white/80">West Boring Canal Road</p>
                                    <p className="text-white/80">Patna - 800001, INDIA</p>
                                </div>
                            </div>

                            {/* NOIDA OFFICE */}
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                                <div className="w-12 h-12 rounded-lg bg-[#ff6b2f] flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1 text-[#ff6b2f]">NOIDA OFFICE</h3>
                                    <p className="text-white/80">Office No 5, Plot 5A</p>
                                    <p className="text-white/80">Sector 16</p>
                                    <p className="text-white/80">Noida - 201301, INDIA</p>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                                <div className="w-12 h-12 rounded-lg bg-[#14b86e] flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">Email</h3>
                                    <p className="text-white/80">marketing@brandsculpt.com</p>
                                </div>
                            </div>

                            {/* Working Hours */}
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                                <div className="w-12 h-12 rounded-lg bg-[#8b5cf6] flex items-center justify-center flex-shrink-0">
                                    <Clock className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">Working Hours</h3>
                                    <p className="text-white/80">Monday - Saturday: 10:00 AM - 6:30 PM</p>
                                    <p className="text-white/80">Sunday: Closed</p>
                                </div>
                            </div>
                        </div>

                        {/* Social Links */}
                        <div>
                            <h3 className="font-semibold mb-3">Follow Us</h3>
                            <div className="flex gap-4">
                                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                                    <Facebook className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                                    <Twitter className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                                    <Instagram className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                                    <Linkedin className="w-5 h-5" />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="bg-white rounded-2xl p-8 shadow-2xl">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Send us a Message</h2>

                        {submitted ? (
                            <div className="text-center py-12">
                                <div className="text-5xl mb-4">✅</div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Message Sent!</h3>
                                <p className="text-gray-600">We'll get back to you soon.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-800"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-800"
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-800"
                                            placeholder="+91 9876543210"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                                        <select
                                            name="subject"
                                            value={formData.subject}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-800"
                                        >
                                            <option value="">Select a subject</option>
                                            <option value="general">General Inquiry</option>
                                            <option value="pricing">Pricing Information</option>
                                            <option value="partnership">Partnership Opportunities</option>
                                            <option value="support">Technical Support</option>
                                            <option value="feedback">Feedback</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                                    <textarea
                                        name="message"
                                        value={formData.message}
                                        onChange={handleChange}
                                        required
                                        rows={5}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none text-gray-800"
                                        placeholder="Write your message here..."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-gradient-to-r from-[#1f3c8f] to-[#3b5cc8] text-white font-bold rounded-lg hover:opacity-90 transition shadow-lg"
                                >
                                    Send Message →
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </section>

            {/* Map Section */}
            <section className="px-6 pb-20">
                <div className="max-w-6xl mx-auto">
                    <div className="rounded-2xl overflow-hidden border border-white/10">
                        <iframe
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3502.5067739556477!2d77.31247881508148!3d28.58553798243726!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390ce45f5b5ea5a5%3A0x6e6a2d6c0c2c2c2c!2sSector%2016%2C%20Noida%2C%20Uttar%20Pradesh%20201301!5e0!3m2!1sen!2sin!4v1702628000000"
                            width="100%"
                            height="400"
                            style={{ border: 0 }}
                            allowFullScreen=""
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Noida Office Location"
                        />
                    </div>
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
