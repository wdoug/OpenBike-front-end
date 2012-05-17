/* This program is free software: you can redistribute it and/or
   modify it under the terms of the GNU Lesser General Public License
   as published by the Free Software Foundation, either version 3 of
   the License, or (at your option) any later version.
   
   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.
   
   You should have received a copy of the GNU General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>. 
*/

otp.namespace("otp.modules.bikeshare");


// TODO: move these to a shared icon libary file

var StartFlagIcon = L.Icon.extend({
    iconUrl: 'images/marker-flag-start-shadowed.png',
    shadowUrl: null,
    iconSize: new L.Point(48, 49),
    iconAnchor: new L.Point(46, 42),
    popupAnchor: new L.Point(0, -16)
});
var startFlag = new StartFlagIcon();

var EndFlagIcon = L.Icon.extend({
    iconUrl: 'images/marker-flag-end-shadowed.png',
    shadowUrl: null,
    iconSize: new L.Point(48, 49),
    iconAnchor: new L.Point(46, 42),
    popupAnchor: new L.Point(0, -16)
});
var endFlag = new EndFlagIcon();

var StartBikeIcon = L.Icon.extend({
    iconUrl: 'images/marker-bike-green-shadowed.png',
    shadowUrl: null,
    iconSize: new L.Point(25, 39),
    iconAnchor: new L.Point(12, 36),
    popupAnchor: new L.Point(0, -36)
});
var startBike = new StartBikeIcon();

var EndBikeIcon = L.Icon.extend({
    iconUrl: 'images/marker-bike-red-shadowed.png',
    shadowUrl: null,
    iconSize: new L.Point(25, 39),
    iconAnchor: new L.Point(12, 36),
    popupAnchor: new L.Point(0, -36)
});
var endBike = new EndBikeIcon();

var SmallBlueIcon = L.Icon.extend({
    iconUrl: 'images/marker-blue-sm.png',
    shadowUrl: null,
    iconSize: new L.Point(9, 16),
    iconAnchor: new L.Point(5, 16),
    popupAnchor: new L.Point(0, -16)
});
var smallBlue = new SmallBlueIcon();

var MediumBlueIcon = L.Icon.extend({
    iconUrl: 'images/marker-blue-med.png',
    shadowUrl: null,
    iconSize: new L.Point(13, 23),
    iconAnchor: new L.Point(7, 23),
    popupAnchor: new L.Point(0, -23)
});
var mediumBlue = new MediumBlueIcon();

var BlueNubIcon = L.Icon.extend({
    iconUrl: 'images/marker-blue-nub.png',
    shadowUrl: null,
    iconSize: new L.Point(11, 8),
    iconAnchor: new L.Point(5, 8),
    popupAnchor: new L.Point(0, -8)
});
var blueNub = new BlueNubIcon();


otp.modules.bikeshare.BikeShareModule = 
    otp.Class(otp.modules.Module, {

    moduleName  : "Bike Share",
        
    startLatLng : null,
    endLatLng   : null,
    
    stations    : null,
    
    markerLayer     : new L.LayerGroup(),
    pathLayer       : new L.LayerGroup(),
    stationsLayer   : new L.LayerGroup(),
    
    resultsWidget   : null,
    tipWidget       : null,
    tipStep         : 0,
    
    currentRequest  : null,

    triangleTimeFactor     : 0.333,
    triangleSlopeFactor    : 0.333,
    triangleSafetyFactor   : 0.334,
    
    aboutWidget		: null,
    contactWidget		: null,
                        
    initialize : function(webapp) {
        otp.modules.Module.prototype.initialize.apply(this, arguments);
                
        this.mapLayers.push(this.pathLayer);
        this.mapLayers.push(this.markerLayer);
        this.mapLayers.push(this.stationsLayer);
       
        this.initStations();
        
        this.tipWidget = this.createWidget("otp-tipWidget", "");
        this.updateTipStep(1);
        
        this.createAboutInfo();
    },

    handleClick : function(event) {
        console.log('bikeshare click at '+event.latlng.lat+", "+event.latlng.lng);
       
        
        if(this.startLatLng == null) {
        	this.startLatLng = new L.LatLng(event.latlng.lat, event.latlng.lng);
        	this.setStartPoint(this.startLatLng, true);
        }
        
        else if(this.endLatLng == null) {
        	this.endLatLng = new L.LatLng(event.latlng.lat, event.latlng.lng);
        	this.setEndPoint(this.endLatLng, true);
        }
    },
    
    trianglePlanTrip : function() {
        var triParams = this.resultsWidget.bikeTriangle.getFormData();
        this.triangleTimeFactor = triParams.triangleTimeFactor;
        this.triangleSlopeFactor = triParams.triangleSlopeFactor;
        this.triangleSafetyFactor = triParams.triangleSafetyFactor;
        this.planTrip();
    },
    
    setStartPoint : function(latlng, update) {
    
    	 var this_ = this;
    	 
         var start = new L.Marker(this.startLatLng, {icon: startFlag, draggable: true}); 
         start.bindPopup('<strong>From:</strong> '+this.startLatLng);
         start.on('dragend', function() {
             this_.startLatLng = start.getLatLng();
             this_.planTrip();
         });
         this.markerLayer.addLayer(start);
         
         if(update)
        	 this.updateTipStep(2);         
    },
    
    setEndPoint : function(latlng, update) {
    	 var this_ = this;
    	 
         var end = new L.Marker(this.endLatLng, {icon: endFlag, draggable: true}); 
         end.bindPopup('<strong>To:</strong> '+this.endLatLng);
         this.markerLayer.addLayer(end);
         end.on('dragend', function() {
             this_.endLatLng = end.getLatLng();
             this_.planTrip();
         });
         
         if(update)
        	 this.planTrip();
   },
    
    
    planTrip : function(existingData, skipSave) {
    	
    	if(this.currentRequest !== null)
        {
    		console.log("Canceling current request.");
        	this.currentRequest.abort();
        	this.currentRequest = null;
        }
    	
    	
    	
        var url = otp.config.hostname + '/opentripplanner-api-webapp/ws/plan';
        this.pathLayer.clearLayers();        
        //this.stationsLayer.clearLayers(); 
        
        var this_ = this;
        
        var data_ = null;
        
        if(existingData)
        	data_ = existingData;
        else
        {
       	 data_ = {             
               fromPlace: this.startLatLng.lat+','+this.startLatLng.lng,
               toPlace: this.endLatLng.lat+','+this.endLatLng.lng,
               mode: 'WALK,BICYCLE',
               optimize: 'TRIANGLE',
               triangleTimeFactor: this_.triangleTimeFactor,
               triangleSlopeFactor: this_.triangleSlopeFactor,
               triangleSafetyFactor: this_.triangleSafetyFactor
           };
       } 	
        
        
        
        this.currentRequest = $.ajax(url, {
            data: data_,
            dataType: 'jsonp',
                
            success: function(data) {
            	
            	if(this_.resultsWidget == null) {
                    this_.resultsWidget = new otp.widgets.TripSummaryWidget('otp-mainTSW', function() {
                        this_.trianglePlanTrip();
                    });
                }
                
                console.log(data);
                var itin = data.plan.itineraries[0];
                var resultsContent = '';
                if(data.plan) {
                    for(var i=0; i < itin.legs.length; i++) {
                        var polyline = new L.EncodedPolyline(itin.legs[i].legGeometry.points);
                        polyline.setStyle({ color : this_.getModeColor(itin.legs[i].mode), weight: 8});
                        this_.pathLayer.addLayer(polyline);
                        if(itin.legs[i].mode === 'BICYCLE') {
                            this_.getStations(polyline.getLatLngs()[0], polyline.getLatLngs()[polyline.getLatLngs().length-1]);
                        }
                    }
                    this_.resultsWidget.updateMetrics(itin);
                    this_.updateTipStep(3);
                    
                    if(!skipSave)
                    	this_.savePlan(data_);
                    
                }
                else {
                    //this_.resultsWidget.noTripFound();
                }
            }
        });
        
        console.log("rw "+this.resultsWidget);
    },
    
    savePlan : function(data){
    	
    	var data_ = {data: data, startLat: this.startLatLng.lat, startLon: this.startLatLng.lng, endLat: this.endLatLng.lat, endLon: this.endLatLng.lng, parrent : this.webapp.currentHash };
    	otp.util.DataStorage.store(data_, this.webapp );
    },
    
    restorePlan : function(data){
    	
    	this.startLatLng = new L.LatLng(data.startLat, data.startLon);
    	this.setStartPoint(this.startLatLng, false);
    	
    	this.endLatLng = new L.LatLng(data.endLat, data.endLon);
    	this.setEndPoint(this.endLatLng, false);
    	
    	this.webapp.setBounds(new L.LatLngBounds([this.startLatLng, this.endLatLng]));
    	
    	this.planTrip(data.data, true);
    },
        
    getModeColor : function(mode) {
        if(mode === "WALK") return '#0f0';
        if(mode === "BICYCLE") return '#f00';
        return '#aaa';
    },
    
    getStations : function(start, end) {
        console.log('stations '+start+' '+end);
        var tol = .0001, distTol = .005;
        
        for(var i=0; i<this.stations.length; i++) {
            var station = this.stations[i].BikeRentalStation;
            if(Math.abs(station.x - start.lng) < tol && Math.abs(station.y - start.lat) < tol) {
                // start station
                this.stationsLayer.removeLayer(station.marker);                        
                var marker = new L.Marker(station.marker.getLatLng(), {icon: startBike});
                marker.bindPopup(this.constructStationInfo("PICK UP BIKE", station));
                this.stationsLayer.addLayer(marker);
                station.marker = marker;
            }
            else if(this.distance(station.x, station.y, this.startLatLng.lng, this.startLatLng.lat) < distTol && 
                    parseInt(station.bikesAvailable) > 0) {
                // start-adjacent station
                this.stationsLayer.removeLayer(station.marker);
                              
                var icon = this.distance(station.x, station.y, this.startLatLng.lng, this.startLatLng.lat) < distTol/2 ?  mediumBlue : smallBlue;
                var marker = new L.Marker(station.marker.getLatLng(), { icon: icon }); 
                marker.bindPopup(this.constructStationInfo("ALTERNATE PICKUP", station));
                this.stationsLayer.addLayer(marker);                        
                station.marker = marker;
            }
            else if(Math.abs(station.x - end.lng) < tol && Math.abs(station.y - end.lat) < tol) {
                // end station
                this.stationsLayer.removeLayer(station.marker);                        
                var marker = new L.Marker(station.marker.getLatLng(), {icon: endBike});
                marker.bindPopup(this.constructStationInfo("DROP OFF BIKE", station));
                this.stationsLayer.addLayer(marker);
                station.marker = marker;
            }
            else if(this.distance(station.x, station.y, this.endLatLng.lng, this.endLatLng.lat) < distTol && 
                    parseInt(station.bikesAvailable) > 0) {
                // end-adjacent station
                this.stationsLayer.removeLayer(station.marker);                        

                var icon = this.distance(station.x, station.y, this.endLatLng.lng, this.endLatLng.lat) < distTol/2 ?  mediumBlue : smallBlue;
                var marker = new L.Marker(station.marker.getLatLng(), {icon: icon}); 
                marker.bindPopup(this.constructStationInfo("ALTERNATE DROP OFF", station));
                this.stationsLayer.addLayer(marker);                        
                station.marker = marker;
            }
            else {
                this.stationsLayer.removeLayer(station.marker);                        
                var marker = new L.Marker(station.marker.getLatLng(), {icon: blueNub}); 
                marker.bindPopup(this.constructStationInfo("BIKE STATION", station));
                this.stationsLayer.addLayer(marker);                        
                station.marker = marker;
            }
        }
    },
    
    
    initStations : function(start, end) {
        //console.log('stations '+start+' '+end);
        var url = otp.config.hostname + '/opentripplanner-api-webapp/ws/bike_rental';
        var this_ = this;
        $.ajax(url, {
            data: {             
            },
            dataType: 'jsonp',
                
            success: function(data) {
                this_.stations = data.stations;
                for(var i=0; i<this_.stations.length; i++) {
                    var station = this_.stations[i].BikeRentalStation;
                    var marker = new L.Marker(new L.LatLng(station.y, station.x), {icon: blueNub}); 
                    marker.bindPopup(this_.constructStationInfo("BIKE STATION", station));
                    this_.stationsLayer.addLayer(marker)
                    station.marker = marker;
                }
            }
        });
        

    },
        
            
    constructStationInfo : function(title, station) {
        var info = "<strong>"+title+"</strong><br/>";
        info += '<strong>Station:</strong> '+station.name+'<br/>';
        info += '<strong>Bikes Available:</strong> '+station.bikesAvailable+'<br/>';
        info += '<strong>Docks Available:</strong> '+station.spacesAvailable;
        return info;
    },
    
    distance : function(x1, y1, x2, y2) {
        return Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
    },
    
    updateTipStep : function(step) {
        if (step <= this.tipStep) return;
        if(step == 1) this.tipWidget.setContent("To Start: Click on the Map to Plan a Bikeshare Trip.");
        if(step == 2) this.tipWidget.setContent("Next: Click Again to Add Your Trip's End Point.");
        if(step == 3) this.tipWidget.setContent("Tip: Drag the Start or End Points to Modify Your Trip.");
        
        this.tipStep = step;
    },
    
    createAboutInfo : function() {
    	this.contactWidget = new otp.widgets.InfoWidget("otp-contactWidget");

		var contactCopy = "<p class='text'>If you'd like to give us feedback please contact us at <a href='http://openplans.org/contact-us/'>OpenPlans</a>.</p>"
			+ "<p class='text'>For information about the upcoming bike share system, visit <a href='http://citibikenyc.com'>Citi Bike</a>.</p>" 
			+ "<p class='text'>For information on the bike share system operator, please contact <a href='http://www.altabicycleshare.com/'>Alta Bicycle Share</a>.</p>" 
			+ "<p class='text'>For information on system sponsorship, please visit <a href='http://NYCBikeShareSponsorship.com'>NYCBikeShareSponsorship.com</a>.</p>"
			+ "<p class='text'>To contact NYC DOT about community outreach and siting, please email bikeshare@dot.nyc.gov.</p>";

		this.contactWidget.setContent("<p class='title'>Contact</p>" + contactCopy);
		this.contactWidget.hide();
    	
        this.aboutWidget = new otp.widgets.InfoWidget("otp-aboutWidget");
		this.aboutWidget.setContent("<p class='title'>About</p>");
		this.aboutWidget.hide();

    },
    
    showAboutInfo : function() {
    	this.aboutWidget.show();
    	this.contactWidget.hide();
    },
    
    showContactInfo : function() {
    	this.aboutWidget.hide();
    	this.contactWidget.show();
    },
    
    CLASS_NAME : "otp.modules.bikeshare.BikeShareModule"
});


//otp.modules.bikeshare.BikeShareModule = new otp.Class(otp.modules.bikeshare.BikeShareModule);
