import { isPrivateAddress } from '../../utils/net.utils';

describe('isPrivateAddress', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['0.0.0.0', 'unspecified'],
    ['10.1.2.3', 'RFC1918 class A'],
    ['172.16.0.1', 'RFC1918 class B, lower bound'],
    ['172.31.255.254', 'RFC1918 class B, upper bound'],
    ['192.168.0.1', 'RFC1918 class C'],
    ['169.254.169.254', 'link-local, the cloud metadata endpoint'],
    ['100.64.0.1', 'carrier-grade NAT'],
  ])('blocks %s (%s)', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    ['93.184.216.34', 'example.com'],
    ['8.8.8.8', 'public resolver'],
    ['172.32.0.1', 'just outside the RFC1918 class B range'],
    ['172.15.0.1', 'just below the RFC1918 class B range'],
    ['192.169.0.1', 'adjacent to 192.168 but public'],
  ])('allows %s (%s)', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it.each(['::1', 'fc00::1', 'fd12:3456::1', 'fe80::1'])('blocks the IPv6 address %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it('allows a public IPv6 address', () => {
    expect(isPrivateAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
  });

  it('unwraps IPv4-mapped IPv6 addresses', () => {
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('does not treat garbage as private', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(false);
  });
});