# TraqOOH API Reference

Base URL: `https://traqooh-backend-python.onrender.com`

## Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (returns role, userId, token) |

## Sites (Inventory)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sites` | List sites (filters: ownerId, vendorId, city, state, siteType, availabilityStatus) |
| POST | `/api/sites` | Create site |
| PUT | `/api/sites/{id}` | Update site |
| DELETE | `/api/sites/{id}` | Delete site |
| POST | `/api/upload` | Upload image → returns imageUrl |

## Campaigns
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List (filters: userId, advertiserId, status) |
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns/{id}` | Get campaign detail with assignments |
| PUT | `/api/campaigns/{id}` | Update campaign |
| DELETE | `/api/campaigns/{id}` | Delete campaign + cleanup |
| POST | `/api/campaigns/{id}/assign-sites-bulk` | Bulk assign sites |
| DELETE | `/api/campaigns/{id}/remove-site/{assignment_id}` | Remove site |

## Advertisers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/advertisers` | List all advertisers |
| POST | `/api/advertisers` | Create advertiser |
| POST | `/api/advertisers/send-access-link` | Generate advertiser portal link |
| POST | `/api/advertisers/create-login` | Create ADVERTISER user account |

## Advertiser Portal (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/access/{token}` | Load campaign data for advertiser |
| POST | `/api/access/{token}/shortlist` | Save shortlist + per-site dates/costs |
| POST | `/api/access/{token}/finalize` | Finalize campaign (advances status) |

## Vendors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendors` | List vendor companies |
| POST | `/api/vendors` | Create vendor |
