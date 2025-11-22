import React, { useEffect, useRef, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";

// Google Maps Script Loader with modern Places API (New) support
let isGoogleMapsLoaded = false;
const loadGoogleMapsScript = () => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps && window.google.maps.places) {
      // eslint-disable-next-line no-console
      console.log('[Maps Loader] ✓ Google Maps and Places already loaded');
      resolve();
      return;
    }

    // Check for existing Maps script tag
    const existing = Array.from(document.getElementsByTagName('script')).find(
      (s) => s.src && s.src.includes('maps.googleapis.com/maps/api/js')
    );

    // Use modern URL structure: separate libraries with comma, include v=weekly
    const srcUrl = 'https://maps.googleapis.com/maps/api/js?key=GOOGLE_API_KEY_HERE&libraries=places,geometry&v=weekly';

    // eslint-disable-next-line no-console
    console.log('[Maps Loader] Loading srcUrl:', srcUrl);
    // eslint-disable-next-line no-console
    console.log('[Maps Loader] Existing script found:', existing ? existing.src : 'none');

    if (existing) {
      // If the existing script is already present, wait for it to fully load
      if (window.google && window.google.maps) {
        // eslint-disable-next-line no-console
        console.log('[Maps Loader] ✓ Reusing existing Maps script');
        resolve();
        return;
      }

      // eslint-disable-next-line no-console
      console.log('[Maps Loader] Waiting for existing script to load...');
      const onLoad = () => {
        existing.removeEventListener('load', onLoad);
        existing.removeEventListener('error', onError);
        if (window.google && window.google.maps) {
          // eslint-disable-next-line no-console
          console.log('[Maps Loader] ✓ Existing script loaded successfully');
          resolve();
        } else {
          reject(new Error('Maps script loaded but window.google.maps is unavailable. Check API key and Cloud project setup.'));
        }
      };
      const onError = () => {
        existing.removeEventListener('load', onLoad);
        existing.removeEventListener('error', onError);
        reject(new Error('Failed to load existing Maps script. Check your API key and network.'));
      };
      existing.addEventListener('load', onLoad);
      existing.addEventListener('error', onError);
      return;
    }

    // Otherwise, inject a new script
    if (isGoogleMapsLoaded) {
      // eslint-disable-next-line no-console
      console.log('[Maps Loader] Script injection in progress, waiting...');
      const checkGoogle = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkGoogle);
          // eslint-disable-next-line no-console
          console.log('[Maps Loader] ✓ Maps loaded');
          resolve();
        }
      }, 100);
      return;
    }

    isGoogleMapsLoaded = true;
    const script = document.createElement('script');
    script.src = srcUrl;
    script.async = true;
    script.defer = true;

    const onLoad = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      if (window.google && window.google.maps) {
        // eslint-disable-next-line no-console
        console.log('[Maps Loader] ✓ New Maps script loaded successfully');
        // eslint-disable-next-line no-console
        console.log('[Maps Loader] Places available?', !!window.google.maps.places);
        resolve();
      } else {
        reject(new Error('Maps script loaded but window.google.maps is unavailable. Ensure your Google Cloud project has Maps JavaScript API enabled.'));
      }
    };

    const onError = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      // eslint-disable-next-line no-console
      console.error('[Maps Loader] ✗ Failed to load Maps script');
      reject(new Error('Failed to load Google Maps script. Verify your API key is valid and billing is enabled.'));
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    document.head.appendChild(script);
    // eslint-disable-next-line no-console
    console.log('[Maps Loader] Injected new script tag');
  });
};

const RouteSetupMapComponent = ({ routeData, setRouteData = null, editable = true, direction = "Incoming" }) => {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const mapRef = useRef(null);
  const searchBoxRef = useRef(null);
  const trafficButtonRef = useRef(null);
  const [map, setMap] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pendingPickup, setPendingPickup] = useState(null);
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  const trafficLayerRef = useRef(null);
  const autocompleteElementRef = useRef(null);
  const placeSelectListenerRef = useRef(null);
  
  const markersRef = useRef({ embarked: null, disembarked: null, pickups: [] });
  const directionsRendererRef = useRef(null);
  const geocoderRef = useRef(null);

  // Reverse geocode coordinates to address
  const reverseGeocode = (lat, lng) => {
    return new Promise((resolve) => {
      if (!geocoderRef.current) {
        resolve("Address not available");
        return;
      }

      geocoderRef.current.geocode(
        { location: { lat, lng } },
        (results, status) => {
          if (status === "OK" && results[0]) {
            resolve(results[0].formatted_address);
          } else {
            resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          }
        }
      );
    });
  };

  // Toggle traffic layer
  const toggleTraffic = () => {
    if (!map || !trafficLayerRef.current) return;

    if (trafficEnabled) {
      trafficLayerRef.current.setMap(null);
      setTrafficEnabled(false);
    } else {
      trafficLayerRef.current.setMap(map);
      setTrafficEnabled(true);
    }
  };

  // Load Google Maps script
  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setIsScriptLoaded(true))
      .catch(err => console.error('Error loading Google Maps:', err));
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isScriptLoaded || !window.google || !mapRef.current) return;

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: { lat: 14.2, lng: 121.16 },
      zoom: 13,
      mapTypeControl: true,
      mapTypeControlOptions: {
        position: window.google.maps.ControlPosition.TOP_RIGHT,
      },
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: window.google.maps.ControlPosition.RIGHT_TOP,
      },
      streetViewControl: true,
      streetViewControlOptions: {
        position: window.google.maps.ControlPosition.RIGHT_TOP,
      },
    });
    
    setMap(mapInstance);
    geocoderRef.current = new window.google.maps.Geocoder();
    trafficLayerRef.current = new window.google.maps.TrafficLayer();

    // Wait for map to be fully initialized
    window.google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
      // Add search box to map using NEW PlaceAutocompleteElement
      if (editable && searchBoxRef.current) {
        try {
          // If Places library is available, use the new PlaceAutocompleteElement
          if (window.google.maps.places && window.google.maps.places.PlaceAutocompleteElement) {
            // Create the PlaceAutocompleteElement
            const autocompleteElement = new window.google.maps.places.PlaceAutocompleteElement();
            autocompleteElementRef.current = autocompleteElement;

            // Style the element
            autocompleteElement.style.cssText = `
              box-sizing: border-box;
              width: 340px;
              height: 44px;
              margin-top: 10px;
              border-radius: 4px;
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
              font-size: 15px;
              display: block;
            `;

            // Add to map controls
            mapInstance.controls[window.google.maps.ControlPosition.TOP_LEFT].push(autocompleteElement);

            // Clean up previous listener if present
            if (placeSelectListenerRef.current) {
              autocompleteElement.removeEventListener('gmp-select', placeSelectListenerRef.current);
              placeSelectListenerRef.current = null;
            }

            // Listen for place selection using the new Places API (New) event
            const handlePlaceSelect = async (event) => {
              const { placePrediction } = event;
              if (!placePrediction || !placePrediction.toPlace) {
                console.log('No placePrediction in gmp-select event');
                return;
              }

              const place = placePrediction.toPlace();

              // Fetch details for this place (required in Places API New)
              try {
                await place.fetchFields({
                  fields: ['displayName', 'formattedAddress', 'location'],
                });
              } catch (fetchError) {
                console.error('Error fetching place details:', fetchError);
                return;
              }

              if (!place.location) {
                console.log('Selected place has no location');
                return;
              }

              const lat = typeof place.location.lat === 'function' ? place.location.lat() : place.location.lat;
              const lng = typeof place.location.lng === 'function' ? place.location.lng() : place.location.lng;
              const address = place.formattedAddress || place.displayName || '';

              // Center map on selected place first
              mapInstance.setCenter(place.location);
              mapInstance.setZoom(17);

              if (selectedMode === 'embarked' && setRouteData) {
                setRouteData((prev) => ({
                  ...prev,
                  embarked: { lat, lng },
                  embarkedAddress: address,
                }));
                setSelectedMode(null);
              } else if (selectedMode === 'disembarked' && setRouteData) {
                setRouteData((prev) => ({
                  ...prev,
                  disembarked: { lat, lng },
                  disembarkedAddress: address,
                }));
                setSelectedMode(null);
              } else if (selectedMode === 'pickup' && setRouteData) {
                setPendingPickup({
                  lat,
                  lng,
                  address,
                  name: place.displayName || '',
                  time: '',
                });
                setShowPickupModal(true);
                setSelectedMode(null);
              }
            };

            placeSelectListenerRef.current = handlePlaceSelect;
            autocompleteElement.addEventListener('gmp-select', handlePlaceSelect);

          } else {
            console.log('PlaceAutocompleteElement not available. Ensure Places API (New) is enabled and `libraries=places` is included.');
          }
        } catch (error) {
          console.error('Error initializing PlaceAutocompleteElement:', error);
          console.log('Search functionality disabled. Please check Places API settings.');
        }
      }

      // Add traffic button to map
      if (editable && trafficButtonRef.current) {
        // Make traffic button visible
        trafficButtonRef.current.style.display = 'flex';
        mapInstance.controls[window.google.maps.ControlPosition.TOP_LEFT].push(trafficButtonRef.current);
      }
    });

  }, [editable, isScriptLoaded]);

  // Reverse geocode existing coordinates when routeData is loaded
  useEffect(() => {
    if (!geocoderRef.current || !map || !setRouteData) return;

    if (routeData.embarked && !routeData.embarkedAddress) {
      reverseGeocode(routeData.embarked.lat, routeData.embarked.lng).then((address) => {
        if (setRouteData) {
          setRouteData((prev) => ({ ...prev, embarkedAddress: address }));
        }
      });
    }

    if (routeData.disembarked && !routeData.disembarkedAddress) {
      reverseGeocode(routeData.disembarked.lat, routeData.disembarked.lng).then((address) => {
        if (setRouteData) {
          setRouteData((prev) => ({ ...prev, disembarkedAddress: address }));
        }
      });
    }

    if (routeData.pickups && routeData.pickups.length > 0) {
      routeData.pickups.forEach((pickup, index) => {
        if (!pickup.address && pickup.lat && pickup.lng) {
          reverseGeocode(pickup.lat, pickup.lng).then((address) => {
            if (setRouteData) {
              setRouteData((prev) => {
                const updatedPickups = [...(prev.pickups || [])];
                updatedPickups[index] = { ...updatedPickups[index], address };
                return { ...prev, pickups: updatedPickups };
              });
            }
          });
        }
      });
    }
  }, [map, routeData.embarked, routeData.disembarked, routeData.pickups?.length, setRouteData]);

  // Handle map clicks
  useEffect(() => {
    if (!map || !editable || !selectedMode) return;

    const listener = map.addListener("click", async (e) => {
      const { latLng } = e;
      const clicked = { lat: latLng.lat(), lng: latLng.lng() };

      if (selectedMode === "embarked" && setRouteData) {
        const address = await reverseGeocode(clicked.lat, clicked.lng);
        setRouteData((prev) => ({
          ...prev,
          embarked: clicked,
          embarkedAddress: address,
        }));
        setSelectedMode(null);
      } else if (selectedMode === "disembarked" && setRouteData) {
        const address = await reverseGeocode(clicked.lat, clicked.lng);
        setRouteData((prev) => ({
          ...prev,
          disembarked: clicked,
          disembarkedAddress: address,
        }));
        setSelectedMode(null);
      } else if (selectedMode === "pickup" && setRouteData) {
        const address = await reverseGeocode(clicked.lat, clicked.lng);
        setPendingPickup({
          ...clicked,
          address: address,
          name: "",
          time: "",
        });
        setShowPickupModal(true);
        setSelectedMode(null);
      }
    });

    return () => window.google.maps.event.removeListener(listener);
  }, [map, editable, selectedMode, setRouteData]);

  const handleAddPickup = () => {
    if (pendingPickup && pendingPickup.name && pendingPickup.time && setRouteData) {
      setRouteData((prev) => ({
        ...prev,
        pickups: [
          ...(prev.pickups || []),
          {
            lat: pendingPickup.lat,
            lng: pendingPickup.lng,
            name: pendingPickup.name,
            time: pendingPickup.time,
            address: pendingPickup.address,
          },
        ],
      }));
      setShowPickupModal(false);
      setPendingPickup(null);
    }
  };

  const handleRemovePickup = (index) => {
    if (setRouteData) {
      setRouteData((prev) => ({
        ...prev,
        pickups: (prev.pickups || []).filter((_, i) => i !== index),
      }));
    }
  };

  // Update markers and draw route along roads
  useEffect(() => {
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => {
      if (Array.isArray(m)) m.forEach((mm) => mm.setMap(null));
      else if (m) m.setMap(null);
    });

    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
    }

    const points = [];

    if (routeData.embarked) {
      const embarkedIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: "#10B981",
        fillOpacity: 0.9,
        scale: 10,
        strokeColor: "white",
        strokeWeight: 2,
      };

      markersRef.current.embarked = new window.google.maps.Marker({
        map,
        position: routeData.embarked,
        icon: embarkedIcon,
        label: {
          text: "S",
          color: "white",
          fontWeight: "bold",
        },
        title: `Embarked: ${routeData.embarkedAddress || "Start Point"}`,
      });
      points.push(routeData.embarked);
    }

    markersRef.current.pickups = (routeData.pickups || []).map((p, i) => {
      const pickupIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: "#4ECDC4",
        fillOpacity: 0.8,
        scale: 8,
        strokeColor: "white",
        strokeWeight: 2,
      };

      const marker = new window.google.maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        icon: pickupIcon,
        label: {
          text: `${i + 1}`,
          color: "white",
          fontWeight: "bold",
        },
        title: `${p.name || `Pickup ${i + 1}`} @ ${p.time || "N/A"}`,
      });
      points.push({ lat: p.lat, lng: p.lng });
      return marker;
    });

    if (routeData.disembarked) {
      const disembarkedIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: "#EF4444",
        fillOpacity: 0.9,
        scale: 10,
        strokeColor: "white",
        strokeWeight: 2,
      };

      markersRef.current.disembarked = new window.google.maps.Marker({
        map,
        position: routeData.disembarked,
        icon: disembarkedIcon,
        label: {
          text: "E",
          color: "white",
          fontWeight: "bold",
        },
        title: `Disembarked: ${routeData.disembarkedAddress || "End Point"}`,
      });
      points.push(routeData.disembarked);
    }

    if (points.length > 1) {
      const directionsService = new window.google.maps.DirectionsService();
      const directionsRenderer = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: "#4285F4",
          strokeWeight: 5,
          strokeOpacity: 0.8,
        },
      });
      directionsRendererRef.current = directionsRenderer;

      const origin = points[0];
      const destination = points[points.length - 1];
      const waypoints = points.slice(1, -1).map((pt) => ({
        location: pt,
        stopover: true,
      }));

      directionsService.route(
        {
          origin,
          destination,
          waypoints: waypoints.length > 0 ? waypoints : undefined,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        },
        (response, status) => {
          if (status === "OK") {
            directionsRenderer.setDirections(response);
            const bounds = new window.google.maps.LatLngBounds();
            response.routes[0].overview_path.forEach((p) => bounds.extend(p));
            map.fitBounds(bounds);
          } else {
            console.error("Directions request failed due to " + status);
          }
        }
      );
    }
  }, [routeData, map]);

  return (
    <div>
      {editable && (
        <div className="mb-3">
          {/* Action Buttons */}
          <div className="d-flex gap-2 flex-wrap mb-2">
            <Button
              variant={selectedMode === "embarked" ? "success" : "outline-success"}
              size="sm"
              onClick={() => setSelectedMode(selectedMode === "embarked" ? null : "embarked")}
            >
              <i className="bi bi-geo-alt-fill me-1"></i>
              {selectedMode === "embarked" ? "Click map to set Embarked" : "Set Embarked"}
            </Button>
            
            <Button
              variant={selectedMode === "pickup" ? "info" : "outline-info"}
              size="sm"
              onClick={() => setSelectedMode(selectedMode === "pickup" ? null : "pickup")}
            >
              <i className="bi bi-plus-circle me-1"></i>
              {selectedMode === "pickup" 
                ? `Click map to add ${direction === "Incoming" ? "Pickup" : "Drop Off"}` 
                : `Add ${direction === "Incoming" ? "Pickup Point" : "Drop Off Point"}`
              }
            </Button>
            
            <Button
              variant={selectedMode === "disembarked" ? "danger" : "outline-danger"}
              size="sm"
              onClick={() => setSelectedMode(selectedMode === "disembarked" ? null : "disembarked")}
            >
              <i className="bi bi-flag-fill me-1"></i>
              {selectedMode === "disembarked" ? "Click map to set Disembarked" : "Set Disembarked"}
            </Button>
          </div>
          {selectedMode && (
            <div className="alert alert-info mb-2 py-2">
              <small>
                <i className="bi bi-info-circle me-1"></i>
                <strong>Search mode active:</strong> Type in the search box inside the map to find a location, or click on the map to set the {selectedMode} point.
              </small>
            </div>
          )}
        </div>
      )}

      {/* Hidden search box container and traffic button that will be added to map */}
      {editable && (
        <>
          <div
            ref={searchBoxRef}
            style={{
              position: 'absolute',
              left: '50%',
              marginLeft: '-170px',
              marginTop: '10px',
              display: 'none'
            }}
          />
          
          <button
            ref={trafficButtonRef}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleTraffic();
            }}
            style={{
              backgroundColor: trafficEnabled ? '#ffc107' : 'white',
              color: trafficEnabled ? 'white' : '#333',
              border: 'none',
              borderRadius: '4px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              height: '44px',
              padding: '0 20px',
              marginTop: '10px',
              marginLeft: '10px',
              display: 'none',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <i className={`bi bi-${trafficEnabled ? 'eye-slash' : 'stoplights'}-fill`} style={{ fontSize: '16px' }}></i>
            <span>{trafficEnabled ? 'Hide Traffic' : 'Show Traffic'}</span>
          </button>
        </>
      )}

      <div
        ref={mapRef}
        style={{ width: "100%", height: "500px", borderRadius: "10px", border: "1px solid #ddd" }}
      ></div>

      {/* Display route summary */}
      {editable && (routeData.embarked || routeData.disembarked || (routeData.pickups && routeData.pickups.length > 0)) && (
        <div className="mt-3">
          <h6>Route Summary:</h6>
          {routeData.embarked && (
            <div className="mb-2">
              <strong className="text-success">Embarked:</strong> {routeData.embarkedAddress || `${routeData.embarked.lat.toFixed(6)}, ${routeData.embarked.lng.toFixed(6)}`}
            </div>
          )}
          {routeData.pickups && routeData.pickups.length > 0 && (
            <div className="mb-2">
              <strong className={`${direction === "Incoming" ? "text-info" : "text-warning"}`}>
                {direction === "Incoming" ? "Pickup" : "Drop Off"} Points ({routeData.pickups.length}):
              </strong>
              <ul className="list-unstyled ms-3">
                {routeData.pickups.map((p, i) => (
                  <li key={i} className="d-flex justify-content-between align-items-center">
                    <span>
                      {i + 1}. <strong>{p.name}</strong> {p.time ? `@ ${p.time}` : ""} - {p.address || `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`}
                    </span>
                    {editable && setRouteData && (
                      <Button
                        variant="link"
                        size="sm"
                        className="text-danger p-0"
                        onClick={() => handleRemovePickup(i)}
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {routeData.disembarked && (
            <div>
              <strong className="text-danger">Disembarked:</strong> {routeData.disembarkedAddress || `${routeData.disembarked.lat.toFixed(6)}, ${routeData.disembarked.lng.toFixed(6)}`}
            </div>
          )}
        </div>
      )}

      {/* Pickup Point Modal */}
      <Modal show={showPickupModal} onHide={() => { setShowPickupModal(false); setPendingPickup(null); }}>
        <Modal.Header closeButton>
          <Modal.Title>Add Pickup Point</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pendingPickup && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Location Address</Form.Label>
                <Form.Control type="text" value={pendingPickup.address || ""} disabled />
                <Form.Text className="text-muted">
                  Coordinates: {pendingPickup.lat.toFixed(6)}, {pendingPickup.lng.toFixed(6)}
                </Form.Text>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Pickup Point Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="text"
                  placeholder="e.g., WalterMart Calamba"
                  value={pendingPickup.name}
                  onChange={(e) => setPendingPickup({ ...pendingPickup, name: e.target.value })}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Pickup Time <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="time"
                  value={pendingPickup.time || ""}
                  onChange={(e) => setPendingPickup({ ...pendingPickup, time: e.target.value })}
                  required
                />
                <Form.Text className="text-muted">
                  Select a pickup time (HH:MM).
                </Form.Text>
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowPickupModal(false); setPendingPickup(null); }}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAddPickup}
            disabled={!pendingPickup || !pendingPickup.name || !pendingPickup.time}
          >
            Add Pickup Point
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default RouteSetupMapComponent;