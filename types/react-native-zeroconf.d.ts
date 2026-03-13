declare module 'react-native-zeroconf' {
  class Zeroconf {
    publishService(type: string, protocol: string, domain: string, name: string, port: number, txt?: Record<string, string>): void;
    unpublishService(name: string): void;
    scan(type: string, protocol: string, domain: string): void;
    stop(): void;
    removeDeviceListeners(): void;
    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback: (...args: any[]) => void): void;
  }
  export default Zeroconf;
}
