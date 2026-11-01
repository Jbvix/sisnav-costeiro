const AutomatedPlanningService = {
    chartGeoDB: {}, // Check file for content, mocking empty for now as we test logic
    portToChart: {
        'BR_VDC': ['301'],
        'BR_BEL': ['301'],
        'BR_ITA': ['410', '411'],
        'BR_FOR': ['710'],
        'BR_PEC': ['710'],
        'BR_NAT': ['810'],
        'BR_CAB': ['830'],
        'BR_REC': ['930'],
        'BR_SUA': ['930'],
        'BR_MAC': ['1000'],
        'BR_SAL': ['1101', '1110'],
        'BR_ILH': ['1201'],
        'BR_VIT': ['1410'],
        'BR_RIO': ['1506'],
        'BR_ITG': ['1600'],
        'BR_ANG': ['1600'],
        'BR_SSB': ['1644'],
        'BR_STS': ['1711'],
        'BR_PNG': ['1820'],
        'BR_ITJ': ['1805', '1902'],
        'BR_RIG': ['2110'],
    },
    // Mock PortDatabase finding
    findPort: function (id) {
        const db = [
            { id: 'BR_ITQ', lat: -2.566, lon: -44.366 },
            { id: 'BR_NAT', lat: -5.755, lon: -35.192 },
            { id: 'BR_REC', lat: -8.050, lon: -34.866 },
            { id: 'BR_SUA', lat: -8.397, lon: -34.959 },
            { id: 'BR_RIG', lat: -32.180, lon: -52.080 }
        ];
        return db.find(p => p.id === id);
    },
    // The Logic to Test
    analyze: function (depId, arrId) {
        console.log(`Analyzing ${depId} -> ${arrId}`);
        const depPort = this.findPort(depId);
        const arrPort = this.findPort(arrId);

        if (!depPort || !arrPort) {
            console.log("Ports not found");
            return;
        }

        let minLat = Math.min(depPort.lat, arrPort.lat);
        let maxLat = Math.max(depPort.lat, arrPort.lat);
        console.log(`Lat Range: ${minLat} to ${maxLat}`);

        const portsToForce = new Set([depId, arrId]);

        // Mock PortDB Iterator
        const allPorts = [
            { id: 'BR_ITQ', name: 'Itaqui', lat: -2.566 },
            { id: 'BR_NAT', name: 'Natal', lat: -5.755 },
            { id: 'BR_REC', name: 'Recife', lat: -8.050 },
            { id: 'BR_SUA', name: 'Suape', lat: -8.397 },
            { id: 'BR_RIG', name: 'Rio Grande', lat: -32.180 }
        ];

        allPorts.forEach(port => {
            if (!portsToForce.has(port.id) && this.portToChart[port.id]) {
                const margin = 0.05;
                const inRange = port.lat >= (minLat - margin) && port.lat <= (maxLat + margin);
                console.log(`Checking ${port.name} (${port.lat}): In Range? ${inRange}`);
                if (inRange) {
                    console.log(`  -> Suggesting Charts: ${this.portToChart[port.id]}`);
                }
            }
        });
    }
};

AutomatedPlanningService.analyze('BR_ITQ', 'BR_RIG');
