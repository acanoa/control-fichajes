import React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { Modal } from '../../../components/ui';

interface MapPickerModalProps {
  open: boolean;
  initialPosition: [number, number];
  lat: number;
  lng: number;
  onLatChange: (lat: number) => void;
  onLngChange: (lng: number) => void;
  onClose: () => void;
}

const DEFAULT_POSITION: [number, number] = [40.416775, -3.703790];

export const MapPickerModal: React.FC<MapPickerModalProps> = ({
  open,
  initialPosition,
  lat,
  lng,
  onLatChange,
  onLngChange,
  onClose
}) => {
  const mapRef = React.useRef<L.Map | null>(null);
  const markerRef = React.useRef<L.Marker | null>(null);
  const initialPositionRef = React.useRef<[number, number]>(initialPosition);
  const callbacks = React.useRef({ onLatChange, onLngChange });
  const [searchText, setSearchText] = React.useState('');

  React.useEffect(() => {
    initialPositionRef.current = initialPosition;
  }, [initialPosition]);

  React.useEffect(() => { callbacks.current = { onLatChange, onLngChange }; }, [onLatChange, onLngChange]);

  React.useEffect(() => {
    if (!open) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      const mapEl = document.getElementById('leaflet-map-picker');
      if (!mapEl) return;

      const [initialLat, initialLng] = initialPositionRef.current;
      const map = L.map('leaflet-map-picker').setView([initialLat, initialLng], 15);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      const defaultIcon = L.icon({
        iconUrl: markerIconUrl,
        iconRetinaUrl: markerIconRetinaUrl,
        shadowUrl: markerShadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowSize: [41, 41]
      });

      const marker = L.marker([initialLat, initialLng], {
        draggable: true,
        icon: defaultIcon
      }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        callbacks.current.onLatChange(pos.lat);
        callbacks.current.onLngChange(pos.lng);
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        callbacks.current.onLatChange(e.latlng.lat);
        callbacks.current.onLngChange(e.latlng.lng);
      });
    }, 200);

    return () => {
      clearTimeout(timer);
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [open]);

  const handleConfirm = () => {
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) return;
    onLatChange(lat);
    onLngChange(lng);
    onClose();
  };

  const handleParseCoordinates = () => {
    const match = searchText.match(/@?(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (match) {
      const parsedLat = Number(match[1]);
      const parsedLng = Number(match[2]);
      if (Math.abs(parsedLat) > 90 || Math.abs(parsedLng) > 180) return;
      onLatChange(parsedLat);
      onLngChange(parsedLng);
      if (mapRef.current && markerRef.current) {
        mapRef.current.setView([parsedLat, parsedLng], 15);
        markerRef.current.setLatLng([parsedLat, parsedLng]);
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Seleccionar ubicación en el mapa"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm}>Confirmar ubicación</button>
        </>
      }
    >
      <div className="mb-3">
        <label className="form-label">Buscar o pegar coordenadas</label>
        <div className="d-flex gap-2">
          <input
            type="text"
            className="form-control"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Ej: 40.416775, -3.703790 o URL de Google Maps"
          />
          <button type="button" className="btn btn-outline-primary" onClick={handleParseCoordinates}>
            Aplicar
          </button>
        </div>
      </div>
      <div className="mb-3 d-flex gap-3">
        <div>
          <label className="form-label">Latitud</label>
          <input type="number" step="any" className="form-control" value={lat} onChange={(e) => onLatChange(Number(e.target.value))} />
        </div>
        <div>
          <label className="form-label">Longitud</label>
          <input type="number" step="any" className="form-control" value={lng} onChange={(e) => onLngChange(Number(e.target.value))} />
        </div>
      </div>
      <div id="leaflet-map-picker" style={{ height: 400, width: '100%' }} />
    </Modal>
  );
};

export { DEFAULT_POSITION };
