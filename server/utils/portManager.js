const net = require('net');
const { exec } = require('child_process');
const os = require('os');

class PortManager {
  constructor() {
    this.isWindows = os.platform() === 'win32';
  }

  // Check if a port is available
  isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, () => {
        server.once('close', () => {
          resolve(true);
        });
        server.close();
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  // Find the next available port starting from a given port
  async findAvailablePort(startPort) {
    let port = startPort;
    while (!(await this.isPortAvailable(port))) {
      port++;
      if (port > startPort + 100) {
        throw new Error(`No available ports found between ${startPort} and ${startPort + 100}`);
      }
    }
    return port;
  }

  // Kill process using a specific port (Windows)
  async killProcessOnPortWindows(port) {
    return new Promise((resolve, reject) => {
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error || !stdout) {
          resolve(false);
          return;
        }

        const lines = stdout.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parts[4];
            if (pid && pid !== '0') {
              exec(`taskkill /PID ${pid} /F`, (killError) => {
                if (killError) {
                  console.log(`⚠️  Could not kill process ${pid}: ${killError.message}`);
                } else {
                  console.log(`✅ Killed process ${pid} using port ${port}`);
                }
              });
            }
          }
        }
        resolve(true);
      });
    });
  }

  // Kill process using a specific port (Unix/Linux/macOS)
  async killProcessOnPortUnix(port) {
    return new Promise((resolve, reject) => {
      exec(`lsof -ti:${port} | xargs kill -9`, (error, stdout) => {
        if (error) {
          resolve(false);
        } else {
          console.log(`✅ Killed process using port ${port}`);
          resolve(true);
        }
      });
    });
  }

  // Kill process using a specific port (cross-platform)
  async killProcessOnPort(port) {
    try {
      if (this.isWindows) {
        return await this.killProcessOnPortWindows(port);
      } else {
        return await this.killProcessOnPortUnix(port);
      }
    } catch (error) {
      console.log(`⚠️  Could not kill process on port ${port}: ${error.message}`);
      return false;
    }
  }

  // Get an available port, optionally killing existing processes
  async getAvailablePort(startPort, killExisting = false) {
    if (await this.isPortAvailable(startPort)) {
      return startPort;
    }

    if (killExisting) {
      console.log(`🔍 Port ${startPort} is in use. Attempting to kill existing process...`);
      await this.killProcessOnPort(startPort);
      
      // Wait a bit for the process to be killed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (await this.isPortAvailable(startPort)) {
        console.log(`✅ Port ${startPort} is now available`);
        return startPort;
      }
    }

    console.log(`🔍 Port ${startPort} is in use. Finding next available port...`);
    const availablePort = await this.findAvailablePort(startPort + 1);
    console.log(`✅ Found available port: ${availablePort}`);
    return availablePort;
  }
}

module.exports = PortManager;
