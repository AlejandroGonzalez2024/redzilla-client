import { useState, useEffect, useRef } from "react";
import GoogleMapReact from "google-map-react";
import { ItemBubble } from "./ItemBubble";
import geoService from "../services/GeoService";

const GoogleMap = ({ initialData, filterStatus, currentLocation, setMaps }) => {
  const [data, setData] = useState(initialData);
  const [zoomValue, setZoomValue] = useState(10);

  useEffect(() => {
    if (!window.prevInitialData)
      window.prevInitialData = "";
    let currentStr = JSON.stringify(initialData);
    if (window.prevInitialData !== currentStr) {
      window.prevInitialData = currentStr;
      window.modify = true;
    }
  }, []);

  const mergeVisibleArea = (oldData, newData) => {
    let merge = [];
    let oldKeys = new Set(oldData.map((item) => item.id));
    if (newData) {
      newData.forEach((item) => {
        if (!oldKeys.has(item.id)) {
          item.isSecondaryResult = true;
        }
        merge.push(item);
      });
    }
    return merge;
  };

function handleZoomChanged (map) {
  setZoomValue(map.zoom);
};

useEffect(() => {

}, [])

const calculateDistance = (lattitude1, longittude1,lattitude2,longittude2) =>
{
      const toRadian = n => (n * Math.PI) / 180
      let lat2 = lattitude2
      let lon2 = longittude2
      let lat1 = lattitude1
      let lon1 = longittude1
      let R = 6371  // km
      let x1 = lat2 - lat1
      let dLat = toRadian(x1)
      let x2 = lon2 - lon1
      let dLon = toRadian(x2)
      let a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadian(lat1)) * Math.cos(toRadian(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
      let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      let d = R * c
      return d 
}
  
  const markRegion =(position) => {
  //  let totalCount = 0;
  let lat = position.getCenter().lat(), lng = position.getCenter().lng();
  /*  for (let i = 0; i < data.length; ++i) 
  {
    if (!data[i].latitude || !data[i].longitude) 
        continue;
    else{
      totalCount++;
      lat += data[i].latitude;
      lng += data[i].longitude;
    }    
  }
  lat = lat / totalCount;
  lng = lng / totalCount;*/
    let distanceArray = [];
    for (let i = 0; i < data.length; ++i) 
    {
      if (!data[i].latitude || !data[i].longitude) continue;
      let distance = calculateDistance(data[i].latitude, data[i].longitude, lat, lng);
      distanceArray.push(distance);
    }
    distanceArray.sort(function(a,b) {return (a-b)});
    let previous_tmp = distanceArray[0];
    let countValue = 0;
    let distanceValue;
    for(let i = 1; i< distanceArray.length; i++)
    {
        if(previous_tmp === distanceArray[i])
          continue;
        else
        {
          countValue++;
          previous_tmp = distanceArray[i];
        }
        if(countValue >= process.env.REACT_APP_MARK_MAX)
        {
           distanceValue = distanceArray[i];
           break; 
        }   
    }
    let markMax = [];
    for(let i = 0; i<data.length; ++i)
    {
      if (!data[i].latitude || !data[i].longitude) continue;
      if(calculateDistance(data[i].latitude, data[i].longitude, lat, lng) <= distanceValue)
      {
        markMax.push({latitude:data[i].latitude,longittude:data[i].longitude});
      }
    }
    //get max latitude
    let region = [];
    let latitudeRegion = 1000, longitudeRegion=1000;
    if(markMax.length > 1)
    {
      markMax.sort(function(a,b) {return (a.latitude-b.latitude)});
      latitudeRegion = markMax[markMax.length-1].latitude - markMax[0].latitude;
      markMax.sort(function(a,b){return (a.longittude-b.longitude)});
      longitudeRegion = markMax[markMax.length-1].longittude - markMax[0].longittude;
    }else if(markMax.length === 1)
    {
      latitudeRegion = lat - markMax[0].latitude;
      longitudeRegion = lng - markMax[0].longittude;
    }
    region.push(latitudeRegion);
    region.push(longitudeRegion);
    return region;
  }

  const mergeDataFunction = (map, maps) => {
    let bounds = new maps.LatLngBounds();
    for (let i = 0; i < data.length; ++i) {
      if (!data[i].latitude || !data[i].longitude) continue;
      let position = new maps.LatLng(data[i].latitude, data[i].longitude);
      bounds.extend(position);
    }
    maps.event.addListener(map, "tilesloaded", () => {
      let bounds = map.getBounds();
      let ne = bounds.getNorthEast();
      let sw = bounds.getSouthWest();
      let screenZoomX = 1;
      let screenZoomY = 1;
//    if(data.length >= process.env.REACT_APP_MARK_MAX)
//    {
        if(window.modify)
        {
          let region = markRegion(bounds);
          window.modify = false;
          if(region[0] !== 1000 && region[1] !== 1000)
          {
            screenZoomX = Math.abs((ne.lat() - sw.lat()) / region[0]);
            screenZoomY = Math.abs((ne.lng() - sw.lng()) / region[1]);
          }
        }   
//    }

      screenZoomX = screenZoomX >= screenZoomY ? screenZoomY: screenZoomX;
      setZoomValue(map.zoom + (screenZoomX > 2.0 ? Math.round(Math.log2(screenZoomX)) : 0));

      const myObj = { ...filterStatus };
      delete myObj.keywords;

      fetch(process.env.REACT_APP_API_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationType: "tabid_coordinates",
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng(),
          per_page: 5000,
          ...myObj,
        }),
      })
        .then((response) => response.json())
        .then((newData) => setData(mergeVisibleArea(data, newData)))
        .catch((error) => console.log(error));
    });
    map.fitBounds(bounds);
  };

  const handleApiLoaded = async (map, maps) => {
    setMaps(maps);
    mergeDataFunction(map, maps);
    let marker = new maps.Marker({
      position: currentLocation,
      map,
      title: "User Location",
    });
    marker.setMap(map);
    const geojson = await geoService()
    const filterData = geojson.features.find(
      (item) =>
        parseInt(item.properties.ZIP) === parseInt(filterStatus.keywords)
    );
    const triangleCoords = [];
    let bounds = new maps.LatLngBounds();

    filterData?.geometry.coordinates[0].forEach((item) => {
      let position = new maps.LatLng(item[1], item[0]);
      bounds.extend(position);
      const oneCoord = {
        lat: item[1],
        lng: item[0],
      };
      triangleCoords.push(oneCoord);
    });
    var bermudaTriangle = new maps.Polygon({
      paths: triangleCoords,
      strokeColor: "#FF0000",
      strokeWeight: 2,
      fillColor: "transparent",
    });
    bermudaTriangle.setMap(map);
    //map.fitBounds(bounds);
  };
 

  return (
    data && (
      <GoogleMapReact 
        options={
            {
              zoomControl:true,
              scaleControl:false,
              disableDoubleClickZoom:true,
              keyboardShortcuts : false,
              //fullscreenControl:false,
              gestureHandling: "greedy",
            }
          }
        yesIWantToUseGoogleMapApiInternals
        bootstrapURLKeys={{
          key: process.env.REACT_APP_GOOGLE_KEY,
          libraries: "places",
        }}
        zoom={zoomValue}
        minZoom={10}
        defaultCenter={currentLocation}
        onGoogleApiLoaded={({ map, maps }) => {
          handleApiLoaded(map, maps)
        }}
        onChange={(map)=>{handleZoomChanged(map)}}
      >
        {data.map((item, i) => {
          const duplicatedItems = data.filter(
            (checkItem) =>
              checkItem.latitude === item.latitude &&
              checkItem.longitude === item.longitude
          );
           return (
            <ItemBubble
              key={item["id"]}
              lat={item["latitude"]}
              lng={item["longitude"]}
              item={item}
              duplicatedItems={duplicatedItems}
            />
          );
        })}
      </GoogleMapReact>
    )
  );
};

export default GoogleMap;
