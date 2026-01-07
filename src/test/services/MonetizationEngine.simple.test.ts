import { MonetizationEngine } from '../../services/MonetizationEngine';

describe('MonetizationEngine Simple Test', () => {
  it('should create an instance', () => {
    const engine = MonetizationEngine.getInstance();
    expect(engine).toBeDefined();
    expect(engine).toBeInstanceOf(MonetizationEngine);
  });

  it('should return the same instance (singleton)', () => {
    const engine1 = MonetizationEngine.getInstance();
    const engine2 = MonetizationEngine.getInstance();
    expect(engine1).toBe(engine2);
  });
});