# Changelog

## 1.0.0 – Test-Prototyp

### Was echt ist
- **Eingaben:** Profil, Komfortkarte, Einsatzzweck, Design, Versanddaten und Umfrage werden wirklich erfasst und gespeichert (nur im Browser).
- **Kamera:** Videoaufnahme (MediaRecorder), Live-Kamerabild im Scan und in der AR-Anprobe.
- **Laufanalyse (wenn verfügbar):** Pose-Erkennung mit MediaPipe auf dem Gerät. Schrittfrequenz, Aufsatz, Kniewinkel, Rumpfneigung und vertikale Bewegung werden aus den erkannten Körperpunkten berechnet.
- **GPX/TCX-Import:** Distanz, Tempo und Höhenmeter werden aus der Datei berechnet.
- **Bewegungssensoren:** Der Scan-Fortschritt reagiert auf die Bewegung des Handys, sofern Sensoren verfügbar sind.
- **Umfrage:** wird an Netlify Forms gesendet (SUS-Wert wird berechnet).

### Was simuliert ist
- **Strava/Apple Health:** keine echte Verbindung. Die Aktivitäten werden aus dem Profil erzeugt und mit „Demo-Daten“ gekennzeichnet.
- **Fußscan:** Es wird nichts gemessen. Punktwolke, Netz, 3D-Modell und Maße werden aus dem Profil (Größe, Schuhgröße, Fußbreite) erzeugt, mit dem Spitznamen als Seed.
- **Laufanalyse (Fallback):** Wenn MediaPipe nicht lädt oder niemand erkannt wird, werden die Werte aus dem Profil geschätzt.
- **KI-Analyse:** regelbasierte Logik (`js/data.js`), kein trainiertes Modell. Die Ladeanimation ist inszeniert.
- **Experten-Prüfung, Chat, Produktions-Tracker, E-Mail:** inszeniert. Keine echte Person, kein Versand.
- **Zahlung und Bestellung:** Demo. Es werden keine Zahlungsdaten abgefragt.

Am Ende der App klärt ein Debriefing-Screen die Testpersonen darüber auf.
