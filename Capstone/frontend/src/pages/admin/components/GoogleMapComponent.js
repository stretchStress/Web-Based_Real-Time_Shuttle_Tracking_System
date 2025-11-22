// GoogleMapComponent.jsx
import React, { useEffect, useRef, useState } from "react";
import api from "../../../api/api";

const GoogleMapComponent = ({
  initialLat = 14.2611649,
  initialLng = 121.1331791,
  zoom = 15,
  apiKey = "GPS_API_KEY_HERE",
  shuttleId,
  // allow callers to control the map container height (e.g. TrackPage passes "100vh")
  height = '600px',
  backendUrl = `${api.defaults.baseURL}/api/shuttles`,
}) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [shuttle, setShuttle] = useState(null);
  const [route, setRoute] = useState(null);
  const [nextPickupPoint, setNextPickupPoint] = useState(null);
  const [eta, setEta] = useState(null);
  const markersRef = useRef([]);
  const pickupMarkersRef = useRef([]);
  const routeMarkersRef = useRef([]);
  const polylineRef = useRef(null);
  const pointerDirectionsRendererRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const radiusCircleRef = useRef(null);
  const visitedPickupsRef = useRef(new Set());
  const tripRecordedRef = useRef(false);
  const hasFittedRouteRef = useRef(false);
  const [hasZoomedToShuttle, setHasZoomedToShuttle] = useState(false);
  const latePickupRef = useRef(null);
  const [lateStatus, setLateStatus] = useState(null);
  const [currentDriverId, setCurrentDriverId] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const RADIUS_METERS = 150;
  const LATE_THRESHOLD_MINUTES = 5;

  // Initialize map
  useEffect(() => {
    if (!window.google || !window.google.maps) {
      console.error("Google Maps JavaScript API not loaded.");
      return;
    }

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: { lat: initialLat, lng: initialLng },
      zoom,
    });

    setMap(mapInstance);
    directionsServiceRef.current = new window.google.maps.DirectionsService();
    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      map: mapInstance,
      suppressMarkers: true, // We'll use custom markers
      // Important: keep the current viewport when new directions are set,
      // so polling updates do not snap the map back every few seconds.
      preserveViewport: true,
      polylineOptions: {
        strokeColor: "#4285F4",
        strokeWeight: 5,
        strokeOpacity: 0.8,
      },
    });
  }, [initialLat, initialLng, zoom]);

  // Fetch shuttle location
  const fetchShuttleLocation = async () => {
    if (!shuttleId) return;
    try {
      const response = await api.get(`${backendUrl}/${shuttleId}/location`, {
        params: { apikey: apiKey },
      });
      if (response.data && response.data.shuttle) {
        setShuttle(response.data.shuttle);
      }
    } catch (error) {
      console.error("Error fetching shuttle location:", error.message);
    }
  };

  // Fetch schedule and route
  const fetchSchedule = async () => {
    if (!shuttleId) return;
    try {
      const response = await api.get(`${backendUrl}/${shuttleId}/schedule`);
      if (response.data && response.data.route) {
        const routeData = response.data.route;
        // Parse pickup_coords if it's a string
        if (routeData.pickup_coords && typeof routeData.pickup_coords === 'string') {
          try {
            routeData.pickup_coords = JSON.parse(routeData.pickup_coords);
          } catch (e) {
            console.error("Error parsing pickup_coords:", e);
            routeData.pickup_coords = [];
          }
        }
        setRoute(routeData);

        // Track the active driver for this shuttle from the schedule payload
        const scheduleData = response.data.schedule || null;
        setCurrentSchedule(scheduleData);

        if (scheduleData && scheduleData.driver_id) {
          setCurrentDriverId(scheduleData.driver_id);
        } else if (scheduleData && scheduleData.driver && scheduleData.driver.id) {
          setCurrentDriverId(scheduleData.driver.id);
        } else {
          setCurrentDriverId(null);
        }
      }
      else {
        // If shuttle has no schedule/route assigned, clear route state so map doesn't require it
        setRoute(null);
        setNextPickupPoint(null);
        setEta(null);
        setCurrentSchedule(null);
        setCurrentDriverId(null);
      }
    } catch (error) {
      console.error("Error fetching schedule:", error.message);
    }
  };

  // Poll every 5 seconds for location
  useEffect(() => {
    fetchShuttleLocation();
    const interval = setInterval(fetchShuttleLocation, 5000);
    return () => clearInterval(interval);
  }, [shuttleId]);

  // Fetch schedule once when shuttleId changes
  useEffect(() => {
    fetchSchedule();
  }, [shuttleId]);

  useEffect(() => {
    visitedPickupsRef.current = new Set();
    latePickupRef.current = null;
    setLateStatus(null);
    setCurrentDriverId(null);

    // On route/schedule change, restore whether this schedule's trip
    // has already been recorded (persisted in localStorage).
    let alreadyRecorded = false;
    try {
      if (
        typeof window !== "undefined" &&
        window.localStorage &&
        currentSchedule?.id &&
        currentSchedule?.date
      ) {
        const storageKey = `tripRecorded:${currentSchedule.id}:${currentSchedule.date}`;
        if (localStorage.getItem(storageKey) === "1") {
          alreadyRecorded = true;
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
    tripRecordedRef.current = alreadyRecorded;
  }, [route?.id, shuttleId, currentSchedule?.id, currentSchedule?.date]);

  // Calculate ETA to next pickup point
  const calculateETA = async (fromLat, fromLng, toLat, toLng) => {
    if (!window.google || !window.google.maps) return null;

    return new Promise((resolve) => {
      const service = new window.google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [{ lat: fromLat, lng: fromLng }],
          destinations: [{ lat: toLat, lng: toLng }],
          travelMode: window.google.maps.TravelMode.DRIVING,
          unitSystem: window.google.maps.UnitSystem.METRIC,
        },
        (response, status) => {
          if (status === "OK" && response.rows[0]?.elements[0]?.status === "OK") {
            const element = response.rows[0].elements[0];
            const duration = element.duration.value; // in seconds
            resolve({
              duration: duration,
              durationText: element.duration.text,
              distance: element.distance.text,
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  };

  // Find next pickup point based on current location, skipping any visited indices
  const findNextPickupPoint = (currentLat, currentLng, pickupCoords, pickupPoints, visitedIndices = new Set()) => {
    if (!pickupCoords || pickupCoords.length === 0) return null;

    let nextIndex = null;

    for (let i = 0; i < pickupCoords.length; i++) {
      if (!visitedIndices.has(i)) {
        nextIndex = i;
        break;
      }
    }

    if (nextIndex === null) {
      return null;
    }

    const coord = pickupCoords[nextIndex];

    return {
      ...coord,
      index: nextIndex,
      name: pickupPoints?.[nextIndex] || `Pickup ${nextIndex + 1}`,
    };
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Update markers and route when shuttle or route changes
  useEffect(() => {
    if (!map || !shuttle) return;

    // Clear existing markers and polyline
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    pickupMarkersRef.current.forEach((m) => m.setMap(null));
    pickupMarkersRef.current = [];
    routeMarkersRef.current.forEach((m) => m.setMap(null));
    routeMarkersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // Shuttle marker using a small SVG image (data URL) so it appears as an image
    const shuttleSvg = `
      <svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>
        <rect x='6' y='14' width='52' height='30' rx='6' ry='6' fill='#4285F4' />
        <rect x='12' y='20' width='12' height='8' rx='1' ry='1' fill='white' />
        <rect x='40' y='20' width='12' height='8' rx='1' ry='1' fill='white' />
        <circle cx='20' cy='46' r='4' fill='#333' />
        <circle cx='44' cy='46' r='4' fill='#333' />
      </svg>
    `;
    const shuttleIconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(shuttleSvg)}`;

    const shuttleIcon = {
      url: shuttleIconUrl,
      scaledSize: new window.google.maps.Size(48, 48),
      anchor: new window.google.maps.Point(24, 24),
    };

    const shuttleMarker = new window.google.maps.Marker({
      position: {
        lat: parseFloat(shuttle.latitude),
        lng: parseFloat(shuttle.longitude),
      },
      map,
      icon: shuttleIcon,
      title: `Plate: ${shuttle.plate}\nModel: ${shuttle.model}`,
      zIndex: 1000,
    });

    markersRef.current.push(shuttleMarker);
    
    // Center on shuttle only once on initial load
    if (!hasZoomedToShuttle) {
      map.setCenter(shuttleMarker.getPosition());
      map.setZoom(17);
      setHasZoomedToShuttle(true);
    }
    // Display full route if available
    if (route) {
      const currentLat = parseFloat(shuttle.latitude);
      const currentLng = parseFloat(shuttle.longitude);
      let nextPoint = null;

      // Always check if shuttle is within disembark radius to record trip once,
      // even if some pickup points were not visited in order.
      if (
        route.disembarked_lat &&
        route.disembarked_lng &&
        !tripRecordedRef.current
      ) {
        const disembarkLat = parseFloat(route.disembarked_lat);
        const disembarkLng = parseFloat(route.disembarked_lng);
        const distanceToDisembarkKm = calculateDistance(
          currentLat,
          currentLng,
          disembarkLat,
          disembarkLng
        );
        if (distanceToDisembarkKm * 1000 <= RADIUS_METERS) {
          tripRecordedRef.current = true;

          // Persist that this schedule's trip has been recorded so that
          // reloading the map does not generate duplicate usage reports.
          try {
            if (
              typeof window !== "undefined" &&
              window.localStorage &&
              currentSchedule?.id &&
              currentSchedule?.date
            ) {
              const storageKey = `tripRecorded:${currentSchedule.id}:${currentSchedule.date}`;
              localStorage.setItem(storageKey, "1");
            }
          } catch (e) {
            // Ignore storage errors
          }

          try {
            const usageDate =
              (currentSchedule && currentSchedule.date) ||
              new Date().toISOString().slice(0, 10);

            api
              .post("/api/reports/trips", {
                shuttle_id: shuttle.id,
                route_id: route.id || null,
                driver_id: currentDriverId || null,
                date: usageDate,
                late_pickup_label: latePickupRef.current?.name || null,
              })
              .catch(() => {});
            latePickupRef.current = null;
          } catch (e) {
            console.error("Failed to record trip usage report:", e);
          }

          // Once disembarked, clear radius/ETA/next-stop indicators so the
          // UI no longer shows an active geofence around the endpoint.
          if (radiusCircleRef.current) {
            try {
              radiusCircleRef.current.setMap(null);
            } catch (e) {}
            radiusCircleRef.current = null;
          }
          visitedPickupsRef.current = new Set();
          setNextPickupPoint(null);
          setEta(null);
        }
      }

      // Build complete route path: embarked -> pickup points -> disembarked
      const routePath = [];
      let pickupCoordsArray = [];
      
      // Parse pickup_coords if needed
      if (route.pickup_coords) {
        // Handle both string and array formats
        if (typeof route.pickup_coords === 'string') {
          try {
            pickupCoordsArray = JSON.parse(route.pickup_coords);
          } catch (e) {
            console.error("Error parsing pickup_coords:", e);
            pickupCoordsArray = [];
          }
        } else if (Array.isArray(route.pickup_coords)) {
          pickupCoordsArray = route.pickup_coords;
        }
      }
      
      // Add embarked point (start)
      if (route.embarked_lat && route.embarked_lng) {
        const embarkedIcon = {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: "#10B981", // Green for start
          fillOpacity: 0.9,
          scale: 10,
          strokeColor: "white",
          strokeWeight: 2,
        };

        const embarkedMarker = new window.google.maps.Marker({
          position: { lat: parseFloat(route.embarked_lat), lng: parseFloat(route.embarked_lng) },
          map,
          icon: embarkedIcon,
          title: `Embarked: ${route.embarked || 'Start Point'}`,
          label: {
            text: "S",
            color: "white",
            fontWeight: "bold",
          },
          zIndex: 800,
        });

        routeMarkersRef.current.push(embarkedMarker);
        routePath.push({ lat: parseFloat(route.embarked_lat), lng: parseFloat(route.embarked_lng) });

        // Add info window for embarked
        const embarkedInfoWindow = new window.google.maps.InfoWindow({
          content: `<div style="padding: 5px;">
            <strong style="color: #10B981;">Embarked: ${route.embarked || 'Start Point'}</strong>
          </div>`,
        });

        embarkedMarker.addListener("click", () => {
          embarkedInfoWindow.open(map, embarkedMarker);
        });
      }

      // Add pickup points
      if (pickupCoordsArray.length > 0 && !tripRecordedRef.current) {
        let lateForNext = null;
        // Find next pickup point, skipping any that were already visited
        nextPoint = findNextPickupPoint(
          currentLat,
          currentLng,
          pickupCoordsArray,
          route.pickup_points,
          visitedPickupsRef.current
        );

        // If we're already inside the radius of the next pickup, mark it visited
        // and immediately look for the following one.
        if (nextPoint) {
          const distanceToNextKm = calculateDistance(
            currentLat,
            currentLng,
            nextPoint.lat,
            nextPoint.lng
          );

          if (
            typeof nextPoint.index === "number" &&
            nextPoint.index >= 0 &&
            route.pickup_times &&
            route.pickup_times[nextPoint.index]
          ) {
            const pickupTimeStr = route.pickup_times[nextPoint.index];
            const [hhStr, mmStr] = String(pickupTimeStr).split(":");
            const now = new Date();
            const scheduled = new Date(now);
            const hh = parseInt(hhStr, 10);
            const mm = parseInt(mmStr, 10);
            if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
              scheduled.setHours(hh, mm, 0, 0);
              const diffMs = now.getTime() - scheduled.getTime();
              if (
                diffMs > LATE_THRESHOLD_MINUTES * 60 * 1000 &&
                distanceToNextKm * 1000 > RADIUS_METERS
              ) {
                const lateMinutes = Math.floor(diffMs / 60000);
                const pickupLabel =
                  route.pickup_points?.[nextPoint.index] ||
                  `Pickup ${nextPoint.index + 1}`;
                lateForNext = {
                  pickupIndex: nextPoint.index,
                  pickupName: pickupLabel,
                  lateMinutes,
                };
                if (!latePickupRef.current) {
                  latePickupRef.current = {
                    index: nextPoint.index,
                    name: pickupLabel,
                  };
                }
              }
            }
          }

          if (distanceToNextKm * 1000 <= RADIUS_METERS) {
            if (typeof nextPoint.index === "number" && nextPoint.index >= 0) {
              visitedPickupsRef.current.add(nextPoint.index);
              nextPoint = findNextPickupPoint(
                currentLat,
                currentLng,
                pickupCoordsArray,
                route.pickup_points,
                visitedPickupsRef.current
              );
            }
          }
        }

        // If there are no remaining pickup points but we have a disembark location,
        // treat the disembarked point as the next stop so ETA and highlighting continue
        if (!nextPoint && route.disembarked_lat && route.disembarked_lng && !tripRecordedRef.current) {
          nextPoint = {
            lat: parseFloat(route.disembarked_lat),
            lng: parseFloat(route.disembarked_lng),
            index: -1,
            name: route.disembarked || "End Point",
          };
        }

        setLateStatus(lateForNext);
        setNextPickupPoint(nextPoint);

        // Calculate ETA to next stop (pickup or disembarked)
        if (nextPoint) {
          calculateETA(currentLat, currentLng, nextPoint.lat, nextPoint.lng)
            .then((etaData) => {
              if (etaData) {
                setEta(etaData);
              } else {
                console.warn("ETA calculation returned null");
                setEta(null);
              }
            })
            .catch((error) => {
              console.error("Error calculating ETA:", error);
              setEta(null);
            });
        } else {
          setEta(null);
        }

        // Create markers for all pickup points
        pickupCoordsArray.forEach((coord, index) => {
          const isNext = nextPoint && nextPoint.index === index;
          const pickupIcon = {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: isNext ? "#FF6B6B" : "#4ECDC4",
            fillOpacity: 0.8,
            scale: isNext ? 10 : 7,
            strokeColor: "white",
            strokeWeight: 2,
          };

          const pickupName =
            route.pickup_points?.[index] || `Pickup Point ${index + 1}`;
          const pickupTime = route.pickup_times?.[index] ? ` @ ${route.pickup_times[index]}` : "";

          const marker = new window.google.maps.Marker({
            position: { lat: parseFloat(coord.lat), lng: parseFloat(coord.lng) },
            map,
            icon: pickupIcon,
            title: `${pickupName}${pickupTime}`,
            label: {
              text: `${index + 1}`,
              color: "white",
              fontWeight: "bold",
            },
            zIndex: isNext ? 999 : 500,
          });

          pickupMarkersRef.current.push(marker);
          routePath.push({ lat: parseFloat(coord.lat), lng: parseFloat(coord.lng) });

          // Add info window for pickup points
          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div style="padding: 5px;">
              <strong>${pickupName}</strong>${pickupTime}
              ${isNext ? '<br/><span style="color: #FF6B6B;">Next Stop</span>' : ""}
            </div>`,
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });
        });
      }

      // Add disembarked point (end)
      if (route.disembarked_lat && route.disembarked_lng) {
        const disembarkedIcon = {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: "#EF4444", // Red for end
          fillOpacity: 0.9,
          scale: 10,
          strokeColor: "white",
          strokeWeight: 2,
        };

        const disembarkedMarker = new window.google.maps.Marker({
          position: { lat: parseFloat(route.disembarked_lat), lng: parseFloat(route.disembarked_lng) },
          map,
          icon: disembarkedIcon,
          title: `Disembarked: ${route.disembarked || 'End Point'}`,
          label: {
            text: "E",
            color: "white",
            fontWeight: "bold",
          },
          zIndex: 800,
        });

        routeMarkersRef.current.push(disembarkedMarker);
        routePath.push({ lat: parseFloat(route.disembarked_lat), lng: parseFloat(route.disembarked_lng) });

        // Add info window for disembarked
        const disembarkedInfoWindow = new window.google.maps.InfoWindow({
          content: `<div style="padding: 5px;">
            <strong style="color: #EF4444;">Disembarked: ${route.disembarked || 'End Point'}</strong>
          </div>`,
        });

        disembarkedMarker.addListener("click", () => {
          disembarkedInfoWindow.open(map, disembarkedMarker);
        });
      }

      // Radius circle around the next pickup or final disembark point.
      let targetLatLng = null;
      let isDisembarkTarget = false;

      if (nextPoint) {
        targetLatLng = {
          lat: parseFloat(nextPoint.lat),
          lng: parseFloat(nextPoint.lng),
        };
        isDisembarkTarget = nextPoint.index === -1;
      } else if (route.disembarked_lat && route.disembarked_lng) {
        targetLatLng = {
          lat: parseFloat(route.disembarked_lat),
          lng: parseFloat(route.disembarked_lng),
        };
        isDisembarkTarget = true;
      }

      // Once the shuttle has effectively disembarked (trip recorded),
      // we no longer show a radius overlay around the end point.
      if (targetLatLng && !tripRecordedRef.current) {
        if (!radiusCircleRef.current) {
          radiusCircleRef.current = new window.google.maps.Circle({
            strokeColor: "#2563EB",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#60A5FA",
            fillOpacity: 0.15,
            map,
            center: targetLatLng,
            radius: RADIUS_METERS,
          });
        } else {
          radiusCircleRef.current.setCenter(targetLatLng);
          radiusCircleRef.current.setRadius(RADIUS_METERS);
          radiusCircleRef.current.setMap(map);
        }
      } else if (radiusCircleRef.current) {
        radiusCircleRef.current.setMap(null);
      }

      // Draw route using DirectionsService (road-following) if we have at least 2 points
      if (routePath.length > 1 && directionsServiceRef.current && directionsRendererRef.current) {
        const origin = routePath[0];
        const destination = routePath[routePath.length - 1];
        const waypoints = routePath.slice(1, -1).map((pt) => ({
          location: pt,
          stopover: true,
        }));

        directionsServiceRef.current.route(
          {
            origin,
            destination,
            waypoints: waypoints.length > 0 ? waypoints : undefined,
            travelMode: window.google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false,
          },
          (response, status) => {
            if (status === "OK") {
              directionsRendererRef.current.setDirections(response);
              // Fit bounds for the route only once so the map doesn't
              // keep snapping back on every shuttle location update.
              if (!hasFittedRouteRef.current) {
                const bounds = new window.google.maps.LatLngBounds();
                response.routes[0].overview_path.forEach((p) => bounds.extend(p));
                bounds.extend({ lat: currentLat, lng: currentLng }); // Include shuttle location
                map.fitBounds(bounds);
                hasFittedRouteRef.current = true;
              }
            } else {
              console.error("Directions request failed:", status);
              // Fallback to simple polyline if DirectionsService fails
              if (routePath.length > 0) {
                polylineRef.current = new window.google.maps.Polyline({
                  path: routePath,
                  geodesic: true,
                  strokeColor: "#4285F4",
                  strokeOpacity: 0.6,
                  strokeWeight: 3,
                  map: map,
                });
                // Fit bounds manually for fallback only once
                if (!hasFittedRouteRef.current) {
                  const bounds = new window.google.maps.LatLngBounds();
                  routePath.forEach((pt) => bounds.extend(pt));
                  bounds.extend({ lat: currentLat, lng: currentLng });
                  map.fitBounds(bounds);
                  hasFittedRouteRef.current = true;
                }
              }
            }
          }
        );
      } else if (routePath.length > 0) {
        // Fallback to simple polyline if we don't have enough points for DirectionsService
        polylineRef.current = new window.google.maps.Polyline({
          path: routePath,
          geodesic: true,
          strokeColor: "#4285F4",
          strokeOpacity: 0.6,
          strokeWeight: 3,
          map: map,
        });
        // Fit bounds manually only once
        if (!hasFittedRouteRef.current) {
          const bounds = new window.google.maps.LatLngBounds();
          routePath.forEach((pt) => bounds.extend(pt));
          bounds.extend({ lat: currentLat, lng: currentLng });
          map.fitBounds(bounds);
          hasFittedRouteRef.current = true;
        }
      }

      // Draw a road-following route from shuttle to next pickup using DirectionsService
      // Clear any previous pointer directions renderer first
      if (pointerDirectionsRendererRef.current) {
        pointerDirectionsRendererRef.current.setMap(null);
        pointerDirectionsRendererRef.current = null;
      }

      if (nextPoint && directionsServiceRef.current) {
        try {
          directionsServiceRef.current.route(
            {
              origin: { lat: currentLat, lng: currentLng },
              destination: { lat: nextPoint.lat, lng: nextPoint.lng },
              travelMode: window.google.maps.TravelMode.DRIVING,
              optimizeWaypoints: false,
            },
            (response, status) => {
              if (status === 'OK' && response) {
                // create a dedicated directions renderer for the pointer line
                pointerDirectionsRendererRef.current = new window.google.maps.DirectionsRenderer({
                  map,
                  suppressMarkers: true,
                  preserveViewport: true,
                  polylineOptions: {
                    strokeColor: '#FF6B6B',
                    strokeOpacity: 0.9,
                    strokeWeight: 3,
                  },
                });
                pointerDirectionsRendererRef.current.setDirections(response);
              } else {
                // fallback: draw straight polyline if directions fail
                const pointerPath = [
                  { lat: currentLat, lng: currentLng },
                  { lat: nextPoint.lat, lng: nextPoint.lng },
                ];
                pointerDirectionsRendererRef.current = new window.google.maps.DirectionsRenderer({
                  map,
                  suppressMarkers: true,
                  preserveViewport: true,
                });
                // convert pointerPath to a simple polyline overlay as fallback
                const fallbackLine = new window.google.maps.Polyline({
                  path: pointerPath,
                  geodesic: true,
                  strokeColor: '#FF6B6B',
                  strokeOpacity: 0.9,
                  strokeWeight: 3,
                  map,
                });
                // store fallbackLine on the renderer so cleanup can remove it
                pointerDirectionsRendererRef.current._fallbackLine = fallbackLine;
              }
            }
          );
        } catch (e) {
          console.error('Failed to request directions for pointer line:', e);
        }
      }

    } else {
      // If no route, center on shuttle only on initial load
      if (!hasZoomedToShuttle) {
        map.panTo(shuttleMarker.getPosition());
        setHasZoomedToShuttle(true);
      }

      // Clear any existing radius circle and reset tracking when no route is present
      if (radiusCircleRef.current) {
        try { radiusCircleRef.current.setMap(null); } catch (e) {}
        radiusCircleRef.current = null;
      }
      visitedPickupsRef.current = new Set();
      tripRecordedRef.current = false;
      latePickupRef.current = null;
      setLateStatus(null);

      // ensure any existing pointer directions renderer / line is removed
      if (pointerDirectionsRendererRef.current) {
        // remove any fallback line
        if (pointerDirectionsRendererRef.current._fallbackLine) {
          try { pointerDirectionsRendererRef.current._fallbackLine.setMap(null); } catch (e) {}
        }
        try { pointerDirectionsRendererRef.current.setMap(null); } catch (e) {}
        pointerDirectionsRendererRef.current = null;
      }
    }

    // cleanup for pointer directions renderer (and any fallback polyline) on unmount/update
    return () => {
      if (pointerDirectionsRendererRef.current) {
        // remove any fallback line created earlier
        if (pointerDirectionsRendererRef.current._fallbackLine) {
          try { pointerDirectionsRendererRef.current._fallbackLine.setMap(null); } catch (e) {}
        }
        try { pointerDirectionsRendererRef.current.setMap(null); } catch (e) {}
        pointerDirectionsRendererRef.current = null;
      }
      if (radiusCircleRef.current) {
        try { radiusCircleRef.current.setMap(null); } catch (e) {}
        radiusCircleRef.current = null;
      }
    };
  }, [map, shuttle, route, hasZoomedToShuttle, currentDriverId]);

  return (
    <div style={{ position: "relative" }}>
      {/* ETA Display */}
      {nextPickupPoint && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            backgroundColor: "white",
            padding: "15px",
            borderRadius: "8px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            zIndex: 1000,
            minWidth: "250px",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <strong style={{ color: "#FF6B6B", fontSize: "14px" }}>
              Next Stop: {nextPickupPoint.name}
            </strong>
          </div>
          {lateStatus && (
            <div
              style={{
                fontSize: "13px",
                color: "#b91c1c",
                fontWeight: "bold",
                marginBottom: "4px",
              }}
            >
              Late by approximately {lateStatus.lateMinutes} min
            </div>
          )}
          {eta ? (
            <>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "#4285F4" }}>
                {eta.durationText}
              </div>
              <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                Distance: {eta.distance}
              </div>
            </>
          ) : (
            <div style={{ fontSize: "14px", color: "#999", fontStyle: "italic" }}>
              Calculating ETA...
            </div>
          )}
        </div>
      )}
      <div
        ref={mapRef}
        className="trackpage-map"
        style={{
          width: "100%",
          height: height,
          borderRadius: "10px",
          border: "1px solid #ccc",
        }}
      />
    </div>
  );
};

export default GoogleMapComponent;
