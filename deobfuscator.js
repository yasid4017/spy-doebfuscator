class Deobfuscator {
    constructor() {
        this.supportedObfuscators = ['prometheus', 'moonsec v3'];
        this.lastDetected = 'unknown';
    }

    /**
     * Deteksi jenis obfuscator
     */
    detectObfuscator(script) {
        // Pola untuk Prometheus
        if (script.includes('loadstring') && 
            script.includes('string.dump') && 
            script.includes('getfenv')) {
            return 'prometheus';
        }

        // Pola untuk Moonsec v3
        if (script.includes('Moonsec') || 
            script.includes('moonsec') ||
            (script.includes('local a =') && script.includes('local b =') && script.includes('local c ='))) {
            return 'moonsec_v3';
        }

        // Pola umum obfuscation
        if (script.match(/local\s+[a-zA-Z_]\w*\s*=\s*({[^}]*})/g) &&
            script.match(/loadstring/g) &&
            script.match(/string\.char/g)) {
            return 'prometheus';
        }

        return 'unknown';
    }

    /**
     * Deobfuscate Prometheus
     */
    deobfuscatePrometheus(script) {
        try {
            let result = script;
            
            // Decode string.char
            const charPattern = /string\.char\(([^)]+)\)/g;
            result = result.replace(charPattern, (match, args) => {
                try {
                    const chars = args.split(',').map(a => parseInt(a.trim()));
                    return `'${String.fromCharCode(...chars)}'`;
                } catch {
                    return match;
                }
            });

            // Cleanup
            result = this.cleanResult(result);

            return {
                success: true,
                deobfuscated: result,
                obfuscator: 'prometheus'
            };
        } catch (error) {
            return {
                success: false,
                error: `Prometheus deobfuscation failed: ${error.message}`
            };
        }
    }

    /**
     * Deobfuscate Moonsec v3
     */
    deobfuscateMoonsec(script) {
        try {
            let result = script;

            // Hapus komentar
            result = result.replace(/--\[\[.*?\]\]/gs, '');
            
            // Decode string arrays
            const arrayPattern = /local\s+([a-zA-Z_]\w*)\s*=\s*{([^}]*)}/g;
            let arrays = {};
            let match;

            while ((match = arrayPattern.exec(result)) !== null) {
                const varName = match[1];
                const arrayContent = match[2];
                try {
                    const values = arrayContent.split(',').map(v => {
                        const trimmed = v.trim();
                        if (trimmed.startsWith("'") || trimmed.startsWith('"')) {
                            return eval(trimmed);
                        }
                        return parseInt(trimmed);
                    });
                    arrays[varName] = values;
                } catch {
                    continue;
                }
            }

            // Ganti referensi array
            for (const [varName, values] of Object.entries(arrays)) {
                const refPattern = new RegExp(`${varName}\\[(\\d+)\\]`, 'g');
                result = result.replace(refPattern, (match, index) => {
                    const idx = parseInt(index);
                    if (values && values[idx - 1] !== undefined) {
                        const val = values[idx - 1];
                        if (typeof val === 'string') {
                            return `"${val}"`;
                        }
                        return val.toString();
                    }
                    return match;
                });
            }

            // Decode string.char
            const charPattern = /string\.char\(([^)]+)\)/g;
            result = result.replace(charPattern, (match, args) => {
                try {
                    const chars = args.split(',').map(a => parseInt(a.trim()));
                    return `'${String.fromCharCode(...chars)}'`;
                } catch {
                    return match;
                }
            });

            result = this.cleanResult(result);

            return {
                success: true,
                deobfuscated: result,
                obfuscator: 'moonsec_v3'
            };
        } catch (error) {
            return {
                success: false,
                error: `Moonsec v3 deobfuscation failed: ${error.message}`
            };
        }
    }

    /**
     * Bersihkan hasil
     */
    cleanResult(script) {
        let result = script;
        
        // Hapus baris kosong berlebihan
        result = result.replace(/\n\s*\n\s*\n/g, '\n\n');

        // Format
        result = result
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');

        // Header
        const header = `--[[
    Deobfuscated by Spy Deobfuscator
    Original Obfuscator: ${this.lastDetected || 'Unknown'}
    Date: ${new Date().toISOString()}
--]]\n\n`;

        return header + result;
    }

    /**
     * Main deobfuscate
     */
    deobfuscate(script) {
        try {
            const obfuscator = this.detectObfuscator(script);
            this.lastDetected = obfuscator;

            let result;

            switch (obfuscator) {
                case 'prometheus':
                    result = this.deobfuscatePrometheus(script);
                    break;
                case 'moonsec_v3':
                    result = this.deobfuscateMoonsec(script);
                    break;
                default:
                    return {
                        success: false,
                        error: 'Unsupported obfuscator. Only Prometheus and Moonsec v3 are supported.'
                    };
            }

            if (result.success) {
                result.deobfuscated = `-- Deobfuscated from ${obfuscator}\n` + result.deobfuscated;
            }

            return result;
        } catch (error) {
            return {
                success: false,
                error: `Deobfuscation failed: ${error.message}`
            };
        }
    }
}

module.exports = Deobfuscator;