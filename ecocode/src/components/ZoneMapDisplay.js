import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, CircleMarker, GeoJSON } from 'react-leaflet';
import { renderToStaticMarkup } from 'react-dom/server'; 
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import '../index.css'; 

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const ZONE_CENTERS = {
    'Zone_A': [28.62, 77.1], 
    'Zone_B': [28.5, 77.2],  
    'Zone_C': [28.68, 77.3], 
};

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

const INITIAL_VIEW = [28.6, 77.2];
const GRADIENT_POINTS = [
    { center: [28.6, 77.2], radius: 60000, key: 'g1', factor: 0.8 }, 
    { center: [28.5, 77.15], radius: 45000, key: 'g2', factor: 0.6 },
    { center: [28.75, 77.25], radius: 35000, key: 'g3', factor: 0.4 },
];

const getColor = (status) => {
    switch (status) {
        case 'critical': return '#E30000'; 
        case 'high':     return '#FF8C00'; 
        case 'medium':   return '#00BFFF'; 
        case 'low':      return '#28A745'; 
        default:         return '#999999';
    }
}

const ZoneMapDisplay = ({ onZoneSelect, loading, forecastData, selectedZoneId }) => {
    const [zoneDemandStatus, setZoneDemandStatus] = useState({});
    const [cityDemandStatus, setCityDemandStatus] = useState('low'); 
    const [cityLoadAvg, setCityLoadAvg] = useState(1000); 

   useEffect(() => {
        if (forecastData && forecastData.predictions) {
            const { predictions, zone_id } = forecastData;
            const avgLoad = predictions.length > 0 
                ? predictions.reduce((sum, p) => sum + p.load_mw, 0) / predictions.length
                : 1000;
            
            setCityLoadAvg(avgLoad);
            
            let status = 'low';
            if (avgLoad > 1400) status = 'critical'; 
            else if (avgLoad > 1200) status = 'high'; 
            else if (avgLoad > 900) status = 'medium'; 
            else status = 'low'; 
            
            setCityDemandStatus(status);
            setZoneDemandStatus(prev => ({ ...prev, [forecastData.zone_id]: status })); 
        }
    }, [forecastData]);

    const baseLoad = 800;
    const maxLoad = 1600;
    const normalizedLoad = Math.min(1, Math.max(0, (cityLoadAvg - baseLoad) / (maxLoad - baseLoad)));
    const gradientOpacityBase = 0.3 + (normalizedLoad * 0.5); 


    const styleZone = (feature) => {
        return {
            fillColor: 'transparent',
            weight: 0, 
            opacity: 0,
            color: 'transparent', 
            fillOpacity: 0
        };
    };

    const onEachFeature = (feature, layer) => {
        layer.on({
            click: (e) => {
                onZoneSelect(feature.properties.id); 
                layer.bringToFront();
            },
        });
    };
    
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
                zoom={10} 
                scrollWheelZoom={false} 
                style={{ height: '100%', borderRadius: '8px' }}
            >
                <TileLayer
                    attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {GRADIENT_POINTS.map((point) => (
                    <CircleMarker
                        key={point.key}
                        center={point.center}
                        radius={point.radius / 10} 
                        pathOptions={{
                            fillColor: getColor(cityDemandStatus), 
                            color: 'transparent', 
                            weight: 0,
                            fillOpacity: gradientOpacityBase * point.factor, 
                        }}
                    />
                ))}

                <GeoJSON 
                    data={DELHIZONES_GEOJSON}
                    style={styleZone} 
                    onEachFeature={onEachFeature} 
                />
                
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