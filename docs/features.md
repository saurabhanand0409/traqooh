# TraqOOH Feature List

## ✅ Built
### Inventory Management
- Add / Edit / Delete OOH sites
- Site fields: Name, Type, Size (W×H), Lighting, State, City, Location, Facing, Rate, Vendor, Image, Remarks
- Availability status: Vacant / Vacant Soon / Booked (computed from dates)
- Hover popup on site name (desktop) with image + full details
- Image enlarge/lightbox on click
- Upload site images to Cloudflare R2

### Campaign Management
- Create / Edit / Delete campaigns
- Employee isolation — each employee sees only their own campaigns
- Campaign detail panel with site list and "Add Sites" tab
- Bulk assign sites to campaign
- Remove sites from campaign
- Send to Advertiser — generates shareable access link
- "Sent ✓" badge once link is generated

### Advertiser Portal (Public)
- Token-based access — no login required
- See all proposed sites with image, metadata, rate
- Shortlist sites (heart toggle)
- Set per-site custom dates or use campaign defaults
- Enter printing type, printing/mounting/other charges per site
- Cost sheet table with grand total
- Save draft selection
- Finalize & Start Campaign → advances campaign status

### Auth
- Employee / Admin login
- Role-based routing (ADMIN, EMPLOYEE, ADVERTISER)
- localStorage token management

## 🔲 Planned
- [ ] Email notifications (send access link via email)
- [ ] Site audit / proof-of-display (upload audit images)
- [ ] Invoice generation
- [ ] Advertiser dashboard (logged-in view)
- [ ] Analytics — campaign performance tracking
- [ ] Mobile app (React Native)
