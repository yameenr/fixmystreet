/*
    XXX Lots overlap with map-OpenLayers.js - refactor!
    XXX Things still need to be changed for mobile use, probably won't work
        there.
    TODO Pin size on report page
*/

var fixmystreet = fixmystreet || {};
fixmystreet.maps = {};

(function() {

    fixmystreet.maps.update_pin = function(lonlat) {
        var lat = lonlat.lat();
        var lon = lonlat.lng();
        document.getElementById('fixmystreet.latitude').value = lat;
        document.getElementById('fixmystreet.longitude').value = lon;
        return {
            'url': { 'lon': lon, 'lat': lat },
            'state': { 'lon': lon, 'lat': lat }
        };
    };

    fixmystreet.maps.begin_report = function(lonlat) {
        if (typeof lonlat.lat !== 'function') {
            lonlat = new google.maps.LatLng(lonlat.lat, lonlat.lon);
        }

        if (fixmystreet.page == 'new') {
            /* Already have a pin */
            fixmystreet.report_marker.setPosition(lonlat);
        } else {
            var marker = new google.maps.Marker({
                position: lonlat,
                draggable: true,
                animation: google.maps.Animation.DROP,
                map: fixmystreet.map
            });
            var l = google.maps.event.addListener(marker, 'dragend', function(){
                fixmystreet.update_pin( marker.getPosition() );
            });
            fixmystreet.report_marker = marker;
            google.maps.event.removeListener(fixmystreet.event_update_map);
            for (m=0; m<fixmystreet.markers.length; m++) {
                fixmystreet.markers[m].setMap(null);
            }
        }
        return lonlat;
    };

    fixmystreet.maps.display_around = function() {
        if (fixmystreet.report_marker) {
            fixmystreet.report_marker.setMap(null);
        }
        fixmystreet.event_update_map = google.maps.event.addListener(fixmystreet.map, 'idle', update_pins);
        google.maps.event.trigger(fixmystreet.map, 'idle');
    };

    function PaddingControl(div) {
        div.style.padding = '40px';
    }

    var infowindow = new google.maps.InfoWindow();
    function make_infowindow(marker) {
        return function() {
            infowindow.setContent(marker.title + "<br><a href=/report/" + marker.id + ">" + translation_strings.more_details + "</a>");
            infowindow.open(fixmystreet.map, marker);
        };
    }

    function markers_list(pins, transform) {
        var markers = [];
        if (fixmystreet.markers) {
            for (var m=0; m<fixmystreet.markers.length; m++) {
                fixmystreet.markers[m].setMap(null);
            }
        }
        for (var i=0; i<pins.length; i++) {
            var pin = pins[i];
            var pin_args = {
                position: new google.maps.LatLng( pin[0], pin[1] ),
                //size: pin[5] || 'normal',
                id: pin[3],
                title: pin[4] || '',
                map: fixmystreet.map
            };
            if (pin[2] == 'green') {
                pin_args.icon = "http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|87dd00";
            }
            if (pin[2] == 'yellow') {
                pin_args.icon = "http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|ffd600";
            }
            var marker = new google.maps.Marker(pin_args);
            if (fixmystreet.page == 'around' || fixmystreet.page == 'reports' || fixmystreet.page == 'my') {
                var l = new google.maps.event.addListener(marker, 'click', make_infowindow(marker));
            }
            markers.push( marker );
        }
        return markers;
    }

    function map_clicked(e) {
        if ($('.js-back-to-report-list').length) {
            $('.js-back-to-report-list').trigger('click');
            return true;
        }

        var lonlat = e.latLng;
        fixmystreet.display.begin_report(lonlat);
    }

    /* Pan data handler */
    function read_pin_json(obj) {
        var current, current_near;
        if (typeof(obj.current) != 'undefined' && (current = document.getElementById('current'))) {
            current.innerHTML = obj.current;
        }
        if (typeof(obj.current_near) != 'undefined' && (current_near = document.getElementById('current_near'))) {
            current_near.innerHTML = obj.current_near;
        }
        fixmystreet.markers = markers_list( obj.pins, false );
    }

    function update_pins() {
        var b = fixmystreet.map.getBounds(),
            b_sw = b.getSouthWest(),
            b_ne = b.getNorthEast(),
            bbox = b_sw.lng() + ',' + b_sw.lat() + ',' + b_ne.lng() + ',' + b_ne.lat(),
            params = {
                bbox: bbox
            };
        if (fixmystreet.all_pins) {
            params.all_pins = 1;
        }
        $.getJSON('/ajax', params, read_pin_json);
    }

    function map_initialize() {
        var centre = new google.maps.LatLng( fixmystreet.latitude, fixmystreet.longitude );
        var map_args = {
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            center: centre,
            zoom: 13 + fixmystreet.zoom,
            disableDefaultUI: true,
            panControl: true,
            panControlOptions: {
                position: google.maps.ControlPosition.RIGHT_TOP
            },
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_TOP
            },
            mapTypeControl: true,
            mapTypeControlOptions: {
                position: google.maps.ControlPosition.RIGHT_TOP,
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
            }
        };
        if (!fixmystreet.zoomToBounds) {
            map_args.minZoom = 13;
            map_args.maxZoom = 18;
        }
        fixmystreet.map = new google.maps.Map(document.getElementById("map"), map_args);

        /* Space above the top right controls */
        var paddingDiv = document.createElement('div');
        var paddingControl = new PaddingControl(paddingDiv);
        paddingDiv.index = 0;
        fixmystreet.map.controls[google.maps.ControlPosition.RIGHT_TOP].push(paddingDiv);

        if (document.getElementById('mapForm')) {
            var l = google.maps.event.addListener(fixmystreet.map, 'click', map_clicked);
        }

        if ( fixmystreet.area.length ) {
            for (var i=0; i<fixmystreet.area.length; i++) {
                var args = {
                    url: "http://mapit.mysociety.org/area/" + fixmystreet.area[i] + ".kml?simplify_tolerance=0.0001",
                    clickable: false,
                    preserveViewport: true,
                    map: fixmystreet.map
                };
                if ( fixmystreet.area.length == 1 ) {
                    args.preserveViewport = false;
                }
                var a = new google.maps.KmlLayer(args);
                a.setMap(fixmystreet.map);
            }
        }

        if (fixmystreet.page == 'around') {
            fixmystreet.event_update_map = google.maps.event.addListener(fixmystreet.map, 'idle', update_pins);
        }

        fixmystreet.markers = markers_list( fixmystreet.pins, true );

        /*
        if ( fixmystreet.zoomToBounds ) {
            var bounds = fixmystreet.markers.getDataExtent();
            if (bounds) {
                var center = bounds.getCenterLonLat();
                var z = fixmystreet.map.getZoomForExtent(bounds);
                if ( z < 13 && $('html').hasClass('mobile') ) {
                    z = 13;
                }
                fixmystreet.map.setCenter(center, z);
            }
        }
        */

        $('#hide_pins_link').click(function(e) {
            var i, m;
            e.preventDefault();
            var showhide = [
                'Show pins', 'Hide pins',
                'Dangos pinnau', 'Cuddio pinnau',
                "Vis nåler", "Gjem nåler",
                "Zeige Stecknadeln", "Stecknadeln ausblenden"
            ];
            for (i=0; i<showhide.length; i+=2) {
                if (this.innerHTML == showhide[i]) {
                    for (m=0; m<fixmystreet.markers.length; m++) {
                        fixmystreet.markers[m].setMap(fixmystreet.map);
                    }
                    this.innerHTML = showhide[i+1];
                } else if (this.innerHTML == showhide[i+1]) {
                    for (m=0; m<fixmystreet.markers.length; m++) {
                        fixmystreet.markers[m].setMap(null);
                    }
                    this.innerHTML = showhide[i];
                }
            }
        });

        $('#all_pins_link').click(function(e) {
            var i;
            e.preventDefault();
            for (i=0; i<fixmystreet.markers.length; i++) {
                fixmystreet.markers[i].setMap(fixmystreet.map);
            }
            var texts = [
                'en', 'Show old', 'Hide old',
                'nb', 'Inkluder utdaterte problemer', 'Skjul utdaterte rapporter',
                'cy', 'Cynnwys hen adroddiadau', 'Cuddio hen adroddiadau'
            ];
            for (i=0; i<texts.length; i+=3) {
                if (this.innerHTML == texts[i+1]) {
                    this.innerHTML = texts[i+2];
                    fixmystreet.markers.protocol.options.params = { all_pins: 1 };
                    fixmystreet.markers.refresh( { force: true } );
                    lang = texts[i];
                } else if (this.innerHTML == texts[i+2]) {
                    this.innerHTML = texts[i+1];
                    fixmystreet.markers.protocol.options.params = { };
                    fixmystreet.markers.refresh( { force: true } );
                    lang = texts[i];
                }
            }
            if (lang == 'cy') {
                document.getElementById('hide_pins_link').innerHTML = 'Cuddio pinnau';
            } else if (lang == 'nb') {
                document.getElementById('hide_pins_link').innerHTML = 'Gjem nåler';
            } else {
                document.getElementById('hide_pins_link').innerHTML = 'Hide pins';
            }
        });

    }

    google.maps.visualRefresh = true;
    google.maps.event.addDomListener(window, 'load', map_initialize);

})();
