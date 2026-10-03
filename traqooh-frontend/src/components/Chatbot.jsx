import React, { useState, useRef, useEffect } from 'react';

const FAQS = {
  // Platform basics
  'what is traqooh': 'TraqOOH is India\'s leading Out-of-Home (OOH) advertising management platform. We connect advertisers with media owners, helping manage billboard inventory, campaigns, bookings, and analytics - all in one place! 🎯',
  'what do you do': 'TraqOOH helps:\n• Media owners manage billboard inventory & get bookings\n• Advertisers find & book advertising spaces\n• Both parties track campaigns with real-time analytics\n\nWe\'re your one-stop solution for OOH advertising!',
  'about': 'TraqOOH is a SaaS platform for OOH advertising. We offer inventory management, campaign tracking, booking system, analytics dashboard, and mobile app for field operations. Founded to simplify outdoor advertising in India.',
  'features': 'Our key features include:\n✅ Billboard inventory management\n✅ Campaign creation & tracking\n✅ Real-time analytics dashboard\n✅ Mobile app for field teams\n✅ Booking management system\n✅ GST-compliant invoicing\n✅ Multi-user access',

  // Pricing & Plans
  'pricing': 'We offer 3 monthly subscription plans:\n\n💫 Starter - ₹2,999/month\n• Up to 10 listings\n• Basic analytics\n• Email support\n\n⚡ Professional - ₹7,999/month (Most Popular)\n• Up to 50 listings\n• Advanced analytics\n• Priority support\n• Featured listings\n\n👑 Enterprise - ₹19,999/month\n• Unlimited listings\n• Dedicated manager\n• API access\n• White-label option',
  'starter plan': 'Starter Plan (₹2,999/month):\n• Up to 10 billboard listings\n• Basic analytics dashboard\n• Email support\n• Standard visibility\n• Monthly reports\n\nPerfect for small media owners getting started!',
  'professional plan': 'Professional Plan (₹7,999/month) - Most Popular:\n• Up to 50 billboard listings\n• Advanced analytics\n• Priority email & chat support\n• Featured listings\n• Weekly reports\n• Campaign insights\n• Competitor analysis',
  'enterprise plan': 'Enterprise Plan (₹19,999/month):\n• Unlimited billboard listings\n• Real-time analytics\n• Dedicated account manager\n• Premium visibility\n• Daily reports\n• API access\n• White-label dashboard\n• Custom integrations\n• SLA guarantee',
  'free trial': 'Yes! All plans come with a 14-day FREE trial. No credit card required to start. Try before you buy! 🎉',
  'trial': 'Yes! All plans come with a 14-day FREE trial. No credit card required to start. Try before you buy! 🎉',

  // Payment
  'payment': 'We accept multiple payment methods:\n💳 Credit/Debit Cards\n📱 UPI (GPay, PhonePe, Paytm)\n🏦 Net Banking\n👛 Wallets\n\nAll payments are secured with 256-bit SSL encryption.',
  'payment methods': 'We accept:\n• All major credit/debit cards (Visa, Mastercard, Rupay)\n• UPI (Google Pay, PhonePe, Paytm, BHIM)\n• Net Banking (All major banks)\n• Wallets (Paytm, Amazon Pay, Mobikwik)',
  'refund': 'We offer a 7-day money-back guarantee on all plans. If you\'re not satisfied, contact support for a full refund. No questions asked!',
  'cancel': 'You can cancel your subscription anytime from your dashboard. Your access continues until the end of the billing period. No cancellation fees!',

  // Registration & Login
  'how to register': 'To register:\n1. Click "Get Started" on homepage\n2. Choose "Media Owner" or "Advertiser"\n3. Fill in company details & GST info\n4. Submit director/owner documents\n5. Verify email & start using!\n\nTakes just 5 minutes! ⏱️',
  'login': 'To login:\n1. Click "Login" on homepage\n2. Enter your registered email & password\n3. Access your dashboard!\n\n🔐 Demo: media.owner1@example.com / Passw0rd!',
  'demo': 'Try our demo account:\n📧 Email: media.owner1@example.com\n🔑 Password: Passw0rd!\n\nExplore all features risk-free!',
  'forgot password': 'Click "Forgot Password" on login page, enter your email, and we\'ll send a reset link. Check spam folder if not received within 5 minutes.',

  // Billboard & Inventory
  'billboard types': 'We support all OOH formats:\n📍 Unipoles\n📍 Hoardings\n📍 Digital Screens (LED/LCD)\n📍 Bus Shelters\n📍 Gantries\n📍 Building Wraps\n📍 Transit Ads\n📍 Street Furniture',
  'add billboard': 'To add a billboard:\n1. Login to dashboard\n2. Go to "Inventory" section\n3. Click "Add New Site"\n4. Fill site details (location, size, type)\n5. Upload photos\n6. Set pricing & availability\n\nYour listing goes live immediately!',
  'inventory': 'Inventory management lets you:\n• Add/edit billboard listings\n• Upload site photos\n• Set pricing & availability\n• Track booking status\n• View site performance\n• Export reports',

  // Cities & Coverage
  'cities': 'We operate in 20+ Indian cities:\n🏙️ Metro: Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Kolkata\n🌆 Tier 2: Pune, Ahmedabad, Jaipur, Lucknow, Patna, Noida\n🏘️ Growing: Chandigarh, Indore, Bhopal, Nagpur, and more!\n\nExpanding every month!',
  'locations': 'We cover major highways, city centers, commercial areas, airports, railway stations, malls, and residential zones across India.',

  // Support & Contact
  'contact': 'Reach us at:\n📧 Email: marketing@brandsculpt.com\n🏢 Head Office: 103, P.V. Complex, West Boring Canal Road, Patna - 800001\n🏢 Noida Office: Office No 5, Plot 5A, Sector 16, Noida - 201301\n⏰ Hours: Mon-Sat, 10 AM - 6:30 PM',
  'support': 'For support:\n📧 Email: marketing@brandsculpt.com\n⏰ Response time: Within 24 hours\n👨‍💼 Enterprise customers get dedicated account manager\n\nWe\'re here to help!',
  'working hours': 'Our working hours:\n🕐 Monday - Saturday: 10:00 AM - 6:30 PM IST\n🚫 Sunday: Closed\n\nEmails received on Sunday are answered Monday morning.',

  // Media Owner & Advertiser
  'media owner': 'Benefits for Media Owners:\n✅ List unlimited billboards\n✅ Receive booking requests\n✅ Manage availability calendar\n✅ Track revenue & analytics\n✅ Mobile app for field teams\n✅ Get paid faster\n\nJoin 500+ media owners on TraqOOH!',
  'advertiser': 'Benefits for Advertisers:\n✅ Browse 10,000+ billboards\n✅ Filter by city, type, budget\n✅ Create multi-city campaigns\n✅ Track campaign performance\n✅ Instant booking confirmation\n✅ Dedicated support',

  // Campaigns
  'campaign': 'A campaign lets you:\n• Book multiple billboards together\n• Set start & end dates\n• Track impressions & reach\n• Monitor performance in real-time\n• Generate reports\n\nPerfect for brand launches & promotions!',
  'create campaign': 'To create a campaign:\n1. Login as advertiser\n2. Browse available billboards\n3. Add sites to cart\n4. Set campaign dates\n5. Confirm & pay\n6. Track performance!\n\nIt\'s that simple! 🚀',

  // Mobile App
  'mobile app': 'Our mobile app helps field teams:\n📸 Capture site photos with GPS\n📍 Update site coordinates\n✅ Mark site status\n📊 View assignments\n📤 Sync data offline\n\nAvailable for Android (iOS coming soon!)',
  'app': 'Download our mobile app for field operations. Available on Android. Features: photo capture, GPS tracking, site verification, offline mode. Perfect for ground staff!',

  // General
  'hello': 'Hello! 👋 Welcome to TraqOOH! I\'m your AI assistant. Ask me about:\n• Pricing & plans\n• Platform features\n• Registration\n• Billboard types\n• Support\n\nHow can I help you today?',
  'hi': 'Hi there! 👋 I\'m TraqBot. I can help you with pricing, features, registration, and more. What would you like to know?',
  'help': 'I can help you with:\n📋 Platform features\n💰 Pricing & plans\n📝 Registration process\n📍 Billboard types\n🏙️ City coverage\n💳 Payment options\n📞 Contact info\n📱 Mobile app\n\nJust type your question!',
  'thanks': 'You\'re welcome! 😊 Is there anything else I can help you with?',
  'thank you': 'Happy to help! 🙌 Feel free to ask if you have more questions.',
  'bye': 'Goodbye! 👋 Thanks for chatting with TraqOOH. Have a great day! Visit us at traqooh.com anytime.',
  'good': 'Great to hear! 😊 Let me know if you need any other information.',
  'awesome': 'Glad I could help! 🎉 Anything else you\'d like to know?',
};

function findBestMatch(input) {
  const lowered = input.toLowerCase().trim();

  // Direct match
  for (const [key, value] of Object.entries(FAQS)) {
    if (lowered.includes(key)) {
      return value;
    }
  }

  // Smart keyword matching
  const keywords = {
    // Registration
    'register': 'how to register',
    'sign up': 'how to register',
    'signup': 'how to register',
    'create account': 'how to register',
    'join': 'how to register',

    // Pricing
    'price': 'pricing',
    'cost': 'pricing',
    'rate': 'pricing',
    'charge': 'pricing',
    'fee': 'pricing',
    'subscription': 'pricing',
    'plan': 'pricing',
    'plans': 'pricing',
    'monthly': 'pricing',
    'how much': 'pricing',

    // Contact
    'email': 'contact',
    'phone': 'contact',
    'call': 'contact',
    'address': 'contact',
    'office': 'contact',
    'reach': 'contact',

    // Billboard
    'billboard': 'billboard types',
    'hoarding': 'billboard types',
    'unipole': 'billboard types',
    'digital screen': 'billboard types',
    'led': 'billboard types',
    'ooh': 'billboard types',
    'outdoor': 'billboard types',
    'ad space': 'billboard types',

    // Location
    'city': 'cities',
    'location': 'cities',
    'where': 'cities',
    'available in': 'cities',
    'cover': 'cities',

    // Users
    'owner': 'media owner',
    'vendor': 'media owner',
    'brand': 'advertiser',
    'agency': 'advertiser',

    // Campaign
    'book': 'campaign',
    'booking': 'campaign',
    'campaign': 'campaign',

    // Login
    'log in': 'login',
    'signin': 'login',
    'sign in': 'login',
    'password': 'login',
    'access': 'login',

    // Demo
    'try': 'demo',
    'test': 'demo',
    'demo': 'demo',
    'sample': 'demo',

    // Payment
    'pay': 'payment',
    'payment': 'payment',
    'card': 'payment',
    'upi': 'payment',
    'bank': 'payment',
    'wallet': 'payment',

    // Support
    'help': 'support',
    'issue': 'support',
    'problem': 'support',
    'not working': 'support',

    // Features
    'feature': 'features',
    'what can': 'features',
    'capability': 'features',
    'do you offer': 'features',

    // App
    'mobile': 'mobile app',
    'android': 'mobile app',
    'ios': 'mobile app',
    'download': 'mobile app',

    // Trial
    'free': 'free trial',
    'trial': 'free trial',

    // Cancel/Refund
    'cancel': 'cancel',
    'refund': 'refund',
    'money back': 'refund',
  };

  for (const [keyword, faqKey] of Object.entries(keywords)) {
    if (lowered.includes(keyword)) {
      return FAQS[faqKey];
    }
  }

  return null;
}

// Follow-up suggestions based on topic
const FOLLOW_UPS = {
  'pricing': ['Starter plan details', 'Professional plan', 'Enterprise plan', 'Free trial', 'Payment methods'],
  'starter plan': ['Professional plan', 'Enterprise plan', 'Free trial', 'How to register?'],
  'professional plan': ['Starter plan details', 'Enterprise plan', 'Free trial', 'Compare plans'],
  'enterprise plan': ['Starter plan details', 'Professional plan', 'Contact sales', 'Book a demo'],
  'free trial': ['Pricing plans', 'How to register?', 'Features', 'Demo login'],
  'payment': ['Pricing plans', 'Refund policy', 'Free trial'],
  'refund': ['Cancel subscription', 'Contact support', 'Pricing plans'],
  'cancel': ['Refund policy', 'Contact support', 'Pricing plans'],
  'how to register': ['Features', 'Pricing plans', 'Demo login', 'Contact info'],
  'login': ['Forgot password', 'How to register?', 'Demo login'],
  'demo': ['Features', 'Pricing plans', 'How to register?'],
  'forgot password': ['Login help', 'Contact support'],
  'billboard types': ['Add billboard', 'Cities covered', 'Pricing plans'],
  'add billboard': ['Inventory management', 'Pricing plans', 'Features'],
  'inventory': ['Add billboard', 'Billboard types', 'Mobile app'],
  'cities': ['Billboard types', 'Pricing plans', 'Contact info'],
  'contact': ['Working hours', 'Support', 'How to register?'],
  'support': ['Contact info', 'Working hours', 'FAQ'],
  'working hours': ['Contact info', 'Support'],
  'media owner': ['How to register?', 'Add billboard', 'Pricing plans', 'Mobile app'],
  'advertiser': ['Create campaign', 'Billboard types', 'Cities covered'],
  'campaign': ['Create campaign', 'Billboard types', 'Pricing plans'],
  'create campaign': ['Billboard types', 'Cities covered', 'Contact sales'],
  'mobile app': ['Features', 'Add billboard', 'Download info'],
  'app': ['Mobile app features', 'Download link', 'Features'],
  'features': ['Pricing plans', 'How to register?', 'Mobile app', 'Demo login'],
  'about': ['Features', 'Pricing plans', 'Contact info'],
  'hello': ['Pricing plans', 'Features', 'How to register?', 'Contact info'],
  'hi': ['Pricing plans', 'Features', 'How to register?', 'Contact info'],
  'help': ['Pricing plans', 'Features', 'How to register?', 'Contact info', 'Support'],
  'default': ['Pricing plans', 'Features', 'How to register?', 'Contact info', 'Demo login'],
};

function getFollowUps(matchedKey) {
  if (matchedKey && FOLLOW_UPS[matchedKey]) {
    return FOLLOW_UPS[matchedKey];
  }
  return FOLLOW_UPS['default'];
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { type: 'bot', text: 'Hello! 👋 I\'m TraqBot, your AI assistant. Ask me anything about TraqOOH - pricing, features, registration, and more!' }
  ]);
  const [input, setInput] = useState('');
  const [currentSuggestions, setCurrentSuggestions] = useState(['Pricing plans', 'Features', 'How to register?', 'Contact info', 'Demo login']);
  const [lastTopic, setLastTopic] = useState('default');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const processMessage = (userMessage) => {
    const lowered = userMessage.toLowerCase();
    let matchedKey = null;

    // Find the matched FAQ key
    for (const key of Object.keys(FAQS)) {
      if (lowered.includes(key)) {
        matchedKey = key;
        break;
      }
    }

    const response = findBestMatch(userMessage);
    const botResponse = response ||
      "I'm not sure about that. Let me suggest some topics I can help you with! 👇";

    // Update suggestions based on topic
    const newSuggestions = getFollowUps(matchedKey);
    setCurrentSuggestions(newSuggestions);
    setLastTopic(matchedKey || 'default');

    return botResponse;
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { type: 'user', text: userMessage }]);
    setInput('');

    // Find response with delay for natural feel
    setTimeout(() => {
      const botResponse = processMessage(userMessage);
      setMessages(prev => [...prev, { type: 'bot', text: botResponse }]);
    }, 500);
  };

  const handleQuickQuestion = (question) => {
    setMessages(prev => [...prev, { type: 'user', text: question }]);

    setTimeout(() => {
      const botResponse = processMessage(question);
      setMessages(prev => [...prev, { type: 'bot', text: botResponse }]);
    }, 500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1f3c8f 0%, #3b5cc8 100%)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(31, 60, 143, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.1)';
          e.target.style.boxShadow = '0 6px 25px rgba(31, 60, 143, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.boxShadow = '0 4px 20px rgba(31, 60, 143, 0.4)';
        }}
      >
        <span style={{ fontSize: '28px' }}>{isOpen ? '✕' : '💬'}</span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '24px',
          width: '380px',
          height: '500px',
          backgroundColor: '#fff',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 999,
          animation: 'slideUp 0.3s ease-out',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1f3c8f 0%, #3b5cc8 100%)',
            color: '#fff',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}>
              🤖
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>TraqBot</div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Always here to help</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            backgroundColor: '#f5f7fa',
          }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '12px',
                }}
              >
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: msg.type === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  backgroundColor: msg.type === 'user' ? '#1f3c8f' : '#fff',
                  color: msg.type === 'user' ? '#fff' : '#333',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  whiteSpace: 'pre-line',
                  fontSize: '14px',
                  lineHeight: '1.4',
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions - Always visible */}
          <div style={{
            padding: '10px 16px',
            backgroundColor: '#f0f4ff',
            borderTop: '1px solid #e0e7ff',
          }}>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
              💡 Suggested topics:
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {currentSuggestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickQuestion(q)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: '1px solid #1f3c8f',
                    backgroundColor: '#fff',
                    color: '#1f3c8f',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: '500',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#1f3c8f';
                    e.target.style.color = '#fff';
                    e.target.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#fff';
                    e.target.style.color = '#1f3c8f';
                    e.target.style.transform = 'scale(1)';
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#fff',
            borderTop: '1px solid #eee',
            display: 'flex',
            gap: '8px',
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '24px',
                border: '1px solid #ddd',
                outline: 'none',
                fontSize: '14px',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: input.trim() ? '#1f3c8f' : '#ddd',
                color: '#fff',
                cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                transition: 'background-color 0.2s',
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
