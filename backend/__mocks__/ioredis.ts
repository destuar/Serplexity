const Redis = jest.fn(() => ({
  on: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  disconnect: jest.fn().mockResolvedValue('OK'),
}));

export default Redis;