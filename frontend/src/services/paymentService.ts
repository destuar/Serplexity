/**
 * @file paymentService.ts
 * @description Service for managing payment operations and subscription handling.
 * Provides payment processing, subscription management, and billing functionality.
 *
 * @dependencies
 * - ../lib/apiClient: For API communication.
 *
 * @exports
 * - Various functions for payment and subscription operations.
 */
import apiClient from '../lib/apiClient';

interface CreateCheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface StripeConfig {
  monthlyPriceId: string;
  annualPriceId: string;
}

export const getStripeConfig = async (): Promise<StripeConfig> => {
  const { data } = await apiClient.get('/payments/config');
  return data;
};

export const createCheckoutSession = async (priceId: string): Promise<CreateCheckoutSessionResponse> => {
  const { data } = await apiClient.post('/payments/create-checkout-session', { priceId });
  return data;
}; 