// ecocode/src/components/ZoneMapDisplay.js

import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, CircleMarker, GeoJSON } from 'react-leaflet';
import { renderToStaticMarkup } from 'react-dom/server'; 
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import '../index.css'; 

// Fix for default Leaflet icon paths in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Define the geographical center coordinates for the labels (markers)
const ZONE_CENTERS = {
    'Zone_A': [28.62, 77.1], 
    'Zone_B': [28.5, 77.2],  
    'Zone_C': [28.68, 77.3], 
};

// Mock GeoJSON data (kept for click areas)
const DELHIZONES_GEOJSON = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { id: "Zone_A", name: "West Delhi (A)", status: "low" }, 
      geometry: { type: "Polygon", coordinates: [[ [77.05, 28.60], [77.15, 28.60], [77.15, 28.70], [77.05, 28.70], [77.05, 28.60] ]] } },
    { type: "Feature", properties: { id: "Zone_B", name: "South Delhi (B)", status: "low" }, 
      geometry: { type: "Polygon", coordinates: [[ [77.15, 28.45], [77.25, 28.45], [77.25, 28.55], [77.15, 28.55], [77.15, 28.45] ]] } },
    { type: "Feature", properties: { id: "Zone_C", name: "North Delhi (C)", status: "low" }, 
      geometry: { type: "Polygon", coordinates: [[ [77.25, 28.65], [77.35, 28.65], [77.35, 28.75], [77.25, 28.75], [77.25, 28.65] ]] } },
  ]
};

const INITIAL_VIEW = [28.6, 77.2]; // Center of Delhi

// Define strategic points for the overlapping gradient effect (FIXED AND CENTERED)
const GRADIENT_POINTS = [
    { center: [28.6, 77.2], radius: 60000, key: 'g1', factor: 0.8 }, // Main Central point (Largest)
    { center: [28.5, 77.15], radius: 45000, key: 'g2', factor: 0.6 }, // South-West point
    { center: [28.75, 77.25], radius: 35000, key: 'g3', factor: 0.4 }, // Far North point
];


// Define a color scale function for the gradient effect
const getColor = (status) => {
    switch (status) {
        case 'critical': return '#E30000'; // Deep Red
        case 'high':     return '#FF8C00'; // Orange
        case 'medium':   return '#00BFFF'; // Deep Sky Blue
        case 'low':      return '#28A745'; // Green
        default:         return '#999999';
    }
}

const ZoneMapDisplay = ({ onZoneSelect, loading, forecastData, selectedZoneId }) => {
    const [zoneDemandStatus, setZoneDemandStatus] = useState({});
    const [cityDemandStatus, setCityDemandStatus] = useState('low'); 
    const [cityLoadAvg, setCityLoadAvg] = useState(1000); 

    // Effect to calculate overall city status
    useEffect(() => {
        if (forecastData && forecastData.predictions) {
            const { predictions, zone_id } = forecastData;
            const avgLoad = predictions.length > 0 
                ? predictions.reduce((sum, p) => sum + p.load_mw, 0) / predictions.length
                : 1000;
            
            setCityLoadAvg(avgLoad);
            
            // Adjusting thresholds based on the simulated load data range (MWs)
            let status = 'low';
            if (avgLoad > 1400) status = 'critical'; 
            else if (avgLoad > 1200) status = 'high'; 
            else if (avgLoad > 900) status = 'medium'; 
            else status = 'low'; 
            
            setCityDemandStatus(status);
            setZoneDemandStatus(prev => ({ ...prev, [forecastData.zone_id]: status })); 
        }
    }, [forecastData]);

    // Calculate opacity based on load for the visual gradient (0.3 to 0.8)
    const baseLoad = 800;
    const maxLoad = 1600;
    const normalizedLoad = Math.min(1, Math.max(0, (cityLoadAvg - baseLoad) / (maxLoad - baseLoad)));
    const gradientOpacityBase = 0.3 + (normalizedLoad * 0.5); // Range from 0.3 to 0.8


    // Styling function for GeoJSON polygons (used only for invisible click areas)
    const styleZone = (feature) => {
        return {
            fillColor: 'transparent',
            weight: 0, // No border
            opacity: 0,
            color: 'transparent', 
            fillOpacity: 0
        };
    };

    // Function to handle map interaction (click listener on GeoJSON)
    const onEachFeature = (feature, layer) => {
        layer.on({
            click: (e) => {
                onZoneSelect(feature.properties.id); 
                layer.bringToFront();
            },
        });
    };
    
    // Custom JSX to render inside the Marker (Zone Labels)
    const createZoneIcon = (label, id) => {
        const isSelected = id === selectedZoneId;
        const html = renderToStaticMarkup(
            <div className={`zone-label-icon ${isSelected ? 'selected' : ''}`}>
                <strong>{label}</strong>
            </div>
        );
        return new L.DivIcon({ html: html, className: 'custom-zone-icon' });
    };


    return (
        <div style={{ position: 'relative', height: '400px', width: '100%', marginBottom: '15px' }}>
            <MapContainer 
                center={INITIAL_VIEW} 
                zoom={10} // Adjusted zoom level to fit the wider area
                scrollWheelZoom={false} 
                style={{ height: '100%', borderRadius: '8px' }}
            >
                <TileLayer
                    attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* 1. RENDER OVERLAPPING CIRCLES FOR GRADIENT EFFECT */}
                {GRADIENT_POINTS.map((point) => (
                    <CircleMarker
                        key={point.key}
                        center={point.center}
                        radius={point.radius / 10} // Radius must be in meters, adjusted factor here
                        pathOptions={{
                            fillColor: getColor(cityDemandStatus), 
                            color: 'transparent', // No border on gradient circles
                            weight: 0,
                            // Dynamic opacity: Fades out based on distance/factor
                            fillOpacity: gradientOpacityBase * point.factor, 
                        }}
                    />
                ))}

                {/* 2. RENDER ZONE POLYGONS (Invisible, for click areas only) */}
                <GeoJSON 
                    data={DELHIZONES_GEOJSON}
                    style={styleZone} 
                    onEachFeature={onEachFeature} 
                />
                
                {/* 3. RENDER CLICKABLE ZONE MARKERS (A, B, C) */}
                {Object.keys(ZONE_CENTERS).map(id => (
                    <Marker 
                        key={id}
                        position={ZONE_CENTERS[id]} 
                        icon={createZoneIcon(id.split('_')[1], id)} 
                        eventHandlers={{
                            click: () => onZoneSelect(id), 
                        }}
                    >
                        <Tooltip>{DELHIZONES_GEOJSON.features.find(f => f.properties.id === id).properties.name}</Tooltip>
                    </Marker>
                ))}


            </MapContainer>
            
            {/* Loading Overlay */}
            {loading && (
                <div className="map-loading-overlay">
                    <div className="spinner"></div>
                    <p>Generating forecast...</p>
                </div>
            )}
        </div>
    );
};

export default ZoneMapDisplay;