export interface PoiIcon {
  id: string;
  label: string;
  path: string; // SVG d attribute; stroke-based, 24x24 viewBox
}

// All paths: stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"
export const POI_ICONS: PoiIcon[] = [
  // Navigation & Location
  { id: 'map-pin', label: 'Map Pin', path: 'M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0M17.657 16.657L13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z' },
  { id: 'map-pin-2', label: 'Pin Filled', path: 'M12 2C8.686 2 6 4.686 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.314-2.686-6-6-6zm0 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z' },
  { id: 'navigation', label: 'Navigation', path: 'M12 2l4.5 16.5-4.5-3-4.5 3z' },
  { id: 'navigation-north', label: 'Navigate', path: 'M12 2l7 19-7-5-7 5zM12 7v5' },
  { id: 'compass', label: 'Compass', path: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M16.5 7.5l-3 6-6 3 3-6z' },
  { id: 'location', label: 'Location', path: 'M21 3L14.5 21 11 14 4 10.5zM14.5 21L11 14' },
  { id: 'flag', label: 'Flag', path: 'M5 5a5 5 0 0 1 7 0 5 5 0 0 0 7 0v9a5 5 0 0 1-7 0 5 5 0 0 0-7 0V5zM5 21v-7' },
  { id: 'flag-2', label: 'Flag Filled', path: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7' },
  { id: 'target', label: 'Target', path: 'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 3v3M12 18v3M3 12h3M18 12h3' },
  { id: 'gps', label: 'GPS', path: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v3M12 19v3M2 12h3M19 12h3' },

  // Residential & Buildings
  { id: 'home', label: 'Home', path: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10' },
  { id: 'home-2', label: 'House', path: 'M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7M10 12v5h4v-5' },
  { id: 'building', label: 'Building', path: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4' },
  { id: 'building-2', label: 'Office', path: 'M3 21h18M4 21V8l8-5 8 5v13M8 10v1M8 13v1M8 16v1M12 10v1M12 13v1M12 16v1M16 10v1M16 13v1M16 16v1' },
  { id: 'tower', label: 'Tower', path: 'M3 21h18M9 21V6l3-3 3 3v15M9 6h6M9 9h6M9 12h6M9 15h6M9 18h6' },
  { id: 'castle', label: 'Castle', path: 'M3 21h18M3 11h18M3 7h1v-4h3v4h4v-4h3v4h4v-4h3v4h1v4H3zM7 11v10M17 11v10M12 11v4' },
  { id: 'warehouse', label: 'Warehouse', path: 'M3 21h18M3 7l9-4 9 4v14H3zM3 7h18M9 21V12h6v9' },

  // Healthcare
  { id: 'hospital', label: 'Hospital', path: 'M3 21h18M3 10l9-7 9 7v11H3zM9 21v-9h6v9M12 7v6M9 10h6' },
  { id: 'cross', label: 'Medical Cross', path: 'M3 12h18M12 3v18M8 7.796A6.978 6.978 0 0 0 5 13a7 7 0 0 0 14 0 6.978 6.978 0 0 0-3-5.204' },
  { id: 'pill', label: 'Pharmacy', path: 'M4.5 12.5l8-8a4.95 4.95 0 1 1 7 7l-8 8a4.95 4.95 0 1 1-7-7zM8.5 8.5l7 7' },
  { id: 'stethoscope', label: 'Clinic', path: 'M6 4a2 2 0 1 0 4 0M8 4v8a6 6 0 0 0 12 0v-2M20 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4' },
  { id: 'heart-pulse', label: 'Healthcare', path: 'M19.5 13.572l-7.5 7.428-7.5-7.428A5 5 0 1 1 12 6.006 5 5 0 1 1 19.5 13.572M3 13h4l3-9 4 18 3-9h4' },
  { id: 'ambulance', label: 'Ambulance', path: 'M3 21h1M17 21h1M2 17l2-6h12l3 6H2zM16 11V6h2l3 5M3 17h14M9 14v3M12 13v4M5 21v-4M15 21v-4M8 8h4M10 6v4' },

  // Education
  { id: 'school', label: 'School', path: 'M12 3l8 4.5v5.25A8.25 8.25 0 0 1 12 21a8.25 8.25 0 0 1-8-8.25V7.5zM12 3v18M9 9h6M9 13h6' },
  { id: 'book', label: 'Library', path: 'M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13' },
  { id: 'pencil', label: 'Education', path: 'M4 20h4l10.5-10.5a2.121 2.121 0 0 0-4-4L4 16v4zM13.5 6.5l4 4' },
  { id: 'university', label: 'University', path: 'M3 21h18M4 21V10l8-7 8 7v11M9 21v-6h6v6M12 3v7' },

  // Food & Drink
  { id: 'restaurant', label: 'Restaurant', path: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v0m0 0v7' },
  { id: 'coffee', label: 'Cafe', path: 'M3 14c.83.642 2.077 1 3.5 1s2.67-.358 3.5-1c.83-.642 2.077-1 3.5-1s2.67.358 3.5 1M8 3a2.4 2.4 0 0 0 0 3 2.4 2.4 0 0 1 0 3M12 3a2.4 2.4 0 0 0 0 3 2.4 2.4 0 0 1 0 3M3 10h14v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8zM17 11h1a2 2 0 0 1 0 4h-1' },
  { id: 'pizza', label: 'Pizza', path: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18' },
  { id: 'burger', label: 'Fast Food', path: 'M3 12h18M3 8a9 9 0 0 1 18 0M5 12a9.9 9.9 0 0 0 14 0M3 16h18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  { id: 'beer', label: 'Bar / Pub', path: 'M15 11v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9M15 5H5l1 6h8l1-6zM3 5h18M8 5V3M12 5V3M15 11h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-4' },
  { id: 'ice-cream', label: 'Ice Cream', path: 'M12 21v-9M8 12a4 4 0 1 1 8 0H8zM8 12H4.5A2.5 2.5 0 0 1 2 9.5v0A2.5 2.5 0 0 1 4.5 7H8M16 12h3.5A2.5 2.5 0 0 0 22 9.5v0A2.5 2.5 0 0 0 19.5 7H16' },
  { id: 'bakery', label: 'Bakery', path: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12c0-2 1.8-4 4-4s4 2 4 4M6.5 17.5C7.9 15.6 9.8 14 12 14s4.1 1.6 5.5 3.5' },

  // Transport
  { id: 'car', label: 'Car', path: 'M5 17H3v-6l2-6h14l2 6v6h-2M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M13 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M3 11h18M9 11l1-6M15 11l-1-6' },
  { id: 'bus', label: 'Bus Stop', path: 'M5 17H3V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12h-2M3 11h18M7 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M13 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M3 7h18' },
  { id: 'train', label: 'Train Station', path: 'M12 4a4 4 0 0 1 4 4v6l2 2v2H6v-2l2-2V8a4 4 0 0 1 4-4zM9 17v2M15 17v2M10 20h4M8 8h8M8 12h8' },
  { id: 'plane', label: 'Airport', path: 'M16 10h4a2 2 0 0 1 0 4h-4l-4 7H9l2-7H7l-2 2H3l2-4-2-4h2l2 2h4L9 3h3z' },
  { id: 'ship', label: 'Port / Marina', path: 'M3 17l3-10h12l3 10H3zM12 7V3M5 3h14M6 17l2 4M18 17l-2 4' },
  { id: 'bike', label: 'Bicycle', path: 'M5 19m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M19 19m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M5 19l3.5-7h7L12 5h4M16 5l-1.5 7' },
  { id: 'parking', label: 'Parking', path: 'M3 3h18v18H3zM9 21V3M9 12h4a3 3 0 0 0 0-6H9' },
  { id: 'fuel', label: 'Gas Station', path: 'M14 11h1a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9l-3-3M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14H4zM4 11h10' },
  { id: 'ev-station', label: 'EV Charging', path: 'M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1M11 15h2M9 11h6M9 7l2 4h2l2-4M7 17H5M19 17h-2' },
  { id: 'taxi', label: 'Taxi', path: 'M5 17H3v-6l2-5h14l2 5v6h-2M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M13 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M3 11h18M8 11l1-5M16 11l-1-5M10 5V3h4v2' },

  // Finance & Services
  { id: 'bank', label: 'Bank', path: 'M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v11M12 10v11M16 10v11' },
  { id: 'atm', label: 'ATM', path: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 10h8M12 8v4M8 15h8M7 15v2' },
  { id: 'shopping', label: 'Shopping Mall', path: 'M3 5a1 1 0 0 1 1-1h1.5l.954 4.772A1 1 0 0 0 7.426 10H17.5l1.5-5M7 13.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0M15 13.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0' },
  { id: 'store', label: 'Store / Shop', path: 'M3 9a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1-2-2zM9 21v-9h6v9M3 8l3-4h12l3 4' },
  { id: 'post-office', label: 'Post Office', path: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l9 6 9-6' },
  { id: 'police', label: 'Police Station', path: 'M9 3h6l2 4H7zM7 7v1a5 5 0 0 0 10 0V7M10 3V1M14 3V1M12 13v3M10 16h4M6 21l2-4M18 21l-2-4M6 21h12' },
  { id: 'fire-station', label: 'Fire Station', path: 'M12 12c-2-2.5-4-5-4-7.5a7 7 0 1 1 14 0c0 2.5-2 5-4 7.5M12 12v10M8 18l4-2 4 2M10 22h4' },

  // Accommodation
  { id: 'hotel', label: 'Hotel', path: 'M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M8 11h8M8 15h8M12 11v4' },
  { id: 'tent', label: 'Campground', path: 'M3 21l9-13 9 13H3zM12 8V4M12 8l-3 4M12 8l3 4' },
  { id: 'cabin', label: 'Cabin', path: 'M4 21h16M3 10l9-6 9 6M4 10v11M20 10v11M8 21V14h8v7' },

  // Nature & Parks
  { id: 'tree', label: 'Park / Garden', path: 'M12 22V12M8 12H4l8-10 8 10h-4M8 12l4-6 4 6' },
  { id: 'mountain', label: 'Mountain', path: 'M3 21l9-15 9 15H3zM9 21l3-5 3 5' },
  { id: 'beach', label: 'Beach', path: 'M12 21a9 9 0 0 1-9-9M12 21a9 9 0 0 0 9-9M12 21V12M3 12a9 9 0 0 1 12.728-8.485M20.471 7.372A9 9 0 0 1 21 12M12 12h9M3 12h2' },
  { id: 'droplet', label: 'River / Lake', path: 'M12 22a6 6 0 0 0 6-6c0-4-6-12-6-12S6 12 6 16a6 6 0 0 0 6 6z' },
  { id: 'sun', label: 'Sunny Area', path: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' },
  { id: 'snowflake', label: 'Ski Resort', path: 'M12 2v20M4.5 5l15 14M19.5 5L4.5 19M2 12h20M5.5 4.5l3 1.5-1.5 3M15.5 4.5l-3 1.5 1.5 3M5.5 19.5l3-1.5-1.5-3M15.5 19.5l-3-1.5 1.5-3' },

  // Entertainment & Recreation
  { id: 'stadium', label: 'Stadium', path: 'M12 21c-5.523 0-10-1.343-10-3v-4c0-1.657 4.477-3 10-3s10 1.343 10 3v4c0 1.657-4.477 3-10 3zM2 14c0-1.657 4.477-3 10-3s10 1.343 10 3' },
  { id: 'theater', label: 'Theater', path: 'M2 10s3-3 10-3 10 3 10 3M2 14s3 3 10 3 10-3 10-3M5 20a2 2 0 1 0 4 0 2 2 0 0 0-4 0M15 20a2 2 0 1 0 4 0 2 2 0 0 0-4 0M5 4a2 2 0 1 0 4 0 2 2 0 0 0-4 0M15 4a2 2 0 1 0 4 0 2 2 0 0 0-4 0' },
  { id: 'music', label: 'Concert / Music', path: 'M9 18V5l12-2v13M9 9l12-2M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0' },
  { id: 'movie', label: 'Cinema', path: 'M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.889L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  { id: 'playground', label: 'Playground', path: 'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M12 3v3M19 6l-2 2M5 6l2 2M12 18v3M4 20h4M16 20h4M7 13a5 5 0 0 0 10 0' },
  { id: 'gym', label: 'Gym', path: 'M6.5 6.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M17.5 6.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M3 12h3M18 12h3M6.5 12h11M7 17a2 2 0 0 1 10 0' },
  { id: 'pool', label: 'Swimming Pool', path: 'M3 17c.83.642 2.077 1 3.5 1s2.67-.358 3.5-1c.83-.642 2.077-1 3.5-1s2.67.358 3.5 1c.83.642 2.077 1 3.5 1M3 6l5 5 4-4 5 5M3 6v8' },

  // Industry & Business
  { id: 'factory', label: 'Factory', path: 'M3 21h18M3 12l5-5v5l5-5v5l5-5v9H3zM3 12V8M21 12V8' },
  { id: 'construction', label: 'Construction', path: 'M5 13l4-4 1.5 1.5L14 7l6 6H5zM5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5M10 18v-2M14 18v-2' },
  { id: 'tools', label: 'Workshop', path: 'M7 10H3l4-4M7 10L3 14M17 10h4l-4-4M17 10l4 4M10 7l-3 3 7 7 3-3-7-7zM8.5 15.5L6 18' },
  { id: 'server', label: 'Data Center', path: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 13a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 7h.01M8 15h.01' },

  // Utilities & Infrastructure
  { id: 'power', label: 'Power Plant', path: 'M12 2v7l3-3M12 9l-3-3M5 12a7 7 0 1 0 14 0M12 21v-3M12 12h7' },
  { id: 'water', label: 'Water Supply', path: 'M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-6-6-8-6-14z' },
  { id: 'wifi', label: 'Hotspot', path: 'M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M5 13a9 9 0 0 1 14 0M2 10a12 12 0 0 1 20 0' },
  { id: 'antenna', label: 'Cell Tower', path: 'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M12 13v8M8.5 7.5a5 5 0 0 1 7 0M5 5a9 9 0 0 1 14 0M2 3a13 13 0 0 1 20 0' },

  // Security & Emergency
  { id: 'shield', label: 'Security Post', path: 'M12 3l8 4v5c0 5.25-3.5 10.15-8 11-4.5-.85-8-5.75-8-11V7z' },
  { id: 'lock', label: 'Secure Area', path: 'M5 11a7 7 0 0 1 14 0v2H5v-2zM5 13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2M12 7v2' },
  { id: 'siren', label: 'Emergency', path: 'M12 2v3M4.929 4.929l2.121 2.121M2 12h3M19.071 4.929l-2.121 2.121M22 12h-3M7 17H5a1 1 0 0 1-1-1v-1a7 7 0 1 1 14 0v1a1 1 0 0 1-1 1h-2M7 17v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2H7z' },

  // Misc & Special
  { id: 'star', label: 'Starred Place', path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z' },
  { id: 'heart', label: 'Favourite', path: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' },
  { id: 'bookmark', label: 'Bookmark', path: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' },
  { id: 'camera', label: 'CCTV / Camera', path: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { id: 'telescope', label: 'Viewpoint', path: 'M4 21L8 10l6 6-10 5zM12 3h2l4 9h-3M7 14l5-1' },
  { id: 'chart', label: 'Business Point', path: 'M18 20V10M12 20V4M6 20v-6' },
  { id: 'package', label: 'Depot / Storage', path: 'M16.5 9.4L7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12' },
  { id: 'recycle', label: 'Recycling', path: 'M12 2l2.4 4.8H21l-5.4 3.9 2.1 5.1-5.7-3.9-5.7 3.9 2.1-5.1L3 6.8h6.6z' },
  { id: 'plant', label: 'Nursery / Garden', path: 'M12 22v-9M9 16c-2.5 0-4.5-1.5-4.5-4 0-2 1.5-3.5 4-4a4.5 4.5 0 0 1 9 0c2.5.5 4 2 4 4 0 2.5-2 4-4.5 4H9z' },
  { id: 'key', label: 'Access Point', path: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4' },
  { id: 'truck', label: 'Truck Stop', path: 'M5 17H3v-5l4-5h9M13 17H5M17 17h2v-4l-2-4M17 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M14 11h4l1 2.5' },
  { id: 'drone', label: 'Drone Zone', path: 'M10 10h4M12 10v4M5 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0M15 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0M7 9l3 3M14 9l-3 3M7 15l3-3M14 15l-3-3' },
  { id: 'signal', label: 'Signal Tower', path: 'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M12 13v9M9 8.929A5 5 0 0 1 17 12M7 6.071A8 8 0 0 1 20 12M5 3.5A12 12 0 0 1 22 12' },
  { id: 'zoom-in', label: 'Watch Point', path: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35M11 8v6M8 11h6' },
  { id: 'archive', label: 'Storage', path: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4' },
  { id: 'lightning', label: 'Substation', path: 'M13 2L3 14h9l-1 8 10-12h-9z' },
  { id: 'sunrise', label: 'Scenic View', path: 'M17 13a5 5 0 1 1-10 0M12 6V2M5 10H1M23 10h-4M5.6 4.6L3 2M20.4 4.6L23 2M12 13v5M3 21h18' },
  { id: 'dice', label: 'Casino', path: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM8.5 8.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0M14.5 8.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0M11.5 12a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0M8.5 15.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0M14.5 15.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0' },
];
