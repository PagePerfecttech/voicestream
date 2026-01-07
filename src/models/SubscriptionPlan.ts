import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { SubscriptionPlan, ClientSubscription, OutputType, Resolution } from '../types/channel';

export class SubscriptionPlanModel {
  /**
   * Create a new subscription plan
   */
  static async create(planData: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionPlan> {
    const planId = uuidv4();
    
    const dbPlanData = {
      id: planId,
      name: planData.name,
      monthly_price: planData.monthlyPrice,
      channel_limit: planData.channelLimit,
      max_resolution: planData.maxResolution,
      output_types: planData.outputTypes,
      storage_limit: planData.storageLimit,
      concurrent_channels: planData.concurrentChannels,
      trial_allowed: planData.trialAllowed,
      tier: planData.tier,
      priority: planData.priority,
    };
    
    await db('subscription_plans').insert(dbPlanData);
    
    return await this.findById(planId);
  }
  
  /**
   * Find subscription plan by ID
   */
  static async findById(planId: string): Promise<SubscriptionPlan> {
    const row = await db('subscription_plans')
      .where('id', planId)
      .first();
      
    if (!row) {
      throw new Error('Subscription plan not found');
    }
    
    return this.mapDbRowToSubscriptionPlan(row);
  }
  
  /**
   * Find subscription plan by name
   */
  static async findByName(name: string): Promise<SubscriptionPlan | null> {
    const row = await db('subscription_plans')
      .where('name', name)
      .first();
      
    if (!row) {
      return null;
    }
    
    return this.mapDbRowToSubscriptionPlan(row);
  }
  
  /**
   * Get all subscription plans
   */
  static async findAll(): Promise<SubscriptionPlan[]> {
    const rows = await db('subscription_plans')
      .orderBy('monthly_price', 'asc');
      
    return rows.map(row => this.mapDbRowToSubscriptionPlan(row));
  }
  
  /**
   * Update subscription plan
   */
  static async update(planId: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    const updateData: any = {};
    
    if (updates.name) updateData.name = updates.name;
    if (updates.monthlyPrice !== undefined) updateData.monthly_price = updates.monthlyPrice;
    if (updates.channelLimit !== undefined) updateData.channel_limit = updates.channelLimit;
    if (updates.maxResolution) updateData.max_resolution = updates.maxResolution;
    if (updates.outputTypes) updateData.output_types = updates.outputTypes;
    if (updates.storageLimit !== undefined) updateData.storage_limit = updates.storageLimit;
    if (updates.concurrentChannels !== undefined) updateData.concurrent_channels = updates.concurrentChannels;
    if (updates.trialAllowed !== undefined) updateData.trial_allowed = updates.trialAllowed;
    if (updates.tier) updateData.tier = updates.tier;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date();
      await db('subscription_plans').where('id', planId).update(updateData);
    }
    
    return await this.findById(planId);
  }
  
  /**
   * Delete subscription plan
   */
  static async delete(planId: string): Promise<void> {
    // Check if plan is in use
    const activeSubscriptions = await db('client_subscriptions')
      .where('plan_id', planId)
      .whereIn('status', ['TRIAL', 'ACTIVE'])
      .count('id as count')
      .first();
      
    const activeCount = parseInt(activeSubscriptions?.count as string || '0');
    
    if (activeCount > 0) {
      throw new Error('Cannot delete subscription plan with active subscriptions');
    }
    
    const result = await db('subscription_plans').where('id', planId).del();
    
    if (result === 0) {
      throw new Error('Subscription plan not found');
    }
  }
  
  /**
   * Check if resolution is allowed for plan
   */
  static isResolutionAllowed(resolution: Resolution, maxResolution: Resolution): boolean {
    const resolutionOrder = { 'SD': 1, 'HD': 2, 'FHD': 3 };
    return resolutionOrder[resolution] <= resolutionOrder[maxResolution];
  }
  
  /**
   * Check if output types are allowed for plan
   */
  static areOutputTypesAllowed(requestedTypes: OutputType[], allowedTypes: OutputType[]): boolean {
    return requestedTypes.every(type => allowedTypes.includes(type));
  }
  
  /**
   * Get plan usage statistics
   */
  static async getPlanUsageStats(planId: string): Promise<{
    activeSubscriptions: number;
    trialSubscriptions: number;
    totalRevenue: number;
  }> {
    const stats = await db('client_subscriptions')
      .where('plan_id', planId)
      .select(
        db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as active_count', ['ACTIVE']),
        db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as trial_count', ['TRIAL'])
      )
      .first();
      
    const plan = await this.findById(planId);
    const totalRevenue = ((stats as any)?.active_count || 0) * plan.monthlyPrice;
    
    return {
      activeSubscriptions: (stats as any)?.active_count || 0,
      trialSubscriptions: (stats as any)?.trial_count || 0,
      totalRevenue,
    };
  }
  
  /**
   * Map database row to SubscriptionPlan object
   */
  private static mapDbRowToSubscriptionPlan(row: any): SubscriptionPlan {
    return {
      id: row.id,
      name: row.name,
      monthlyPrice: parseFloat(row.monthly_price),
      channelLimit: row.channel_limit,
      maxResolution: row.max_resolution,
      outputTypes: row.output_types,
      storageLimit: row.storage_limit,
      concurrentChannels: row.concurrent_channels,
      trialAllowed: row.trial_allowed,
      tier: row.tier || 'BASIC',
      priority: row.priority || 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class ClientSubscriptionModel {
  /**
   * Create a new client subscription
   */
  static async create(subscriptionData: Omit<ClientSubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<ClientSubscription> {
    const subscriptionId = uuidv4();
    
    const dbSubscriptionData = {
      id: subscriptionId,
      client_id: subscriptionData.clientId,
      plan_id: subscriptionData.planId,
      status: subscriptionData.status,
      start_date: subscriptionData.startDate,
      end_date: subscriptionData.endDate,
      trial_end_date: subscriptionData.trialEndDate,
    };
    
    await db('client_subscriptions').insert(dbSubscriptionData);
    
    return await this.findById(subscriptionId);
  }
  
  /**
   * Find client subscription by ID
   */
  static async findById(subscriptionId: string): Promise<ClientSubscription> {
    const row = await db('client_subscriptions')
      .where('id', subscriptionId)
      .first();
      
    if (!row) {
      throw new Error('Client subscription not found');
    }
    
    return this.mapDbRowToClientSubscription(row);
  }
  
  /**
   * Find active subscription for client
   */
  static async findActiveByClientId(clientId: string): Promise<ClientSubscription | null> {
    const row = await db('client_subscriptions')
      .where('client_id', clientId)
      .whereIn('status', ['TRIAL', 'ACTIVE'])
      .where('end_date', '>', new Date())
      .first();
      
    if (!row) {
      return null;
    }
    
    return this.mapDbRowToClientSubscription(row);
  }
  
  /**
   * Get client subscription with plan details
   */
  static async getSubscriptionWithPlan(clientId: string): Promise<{
    subscription: ClientSubscription;
    plan: SubscriptionPlan;
  } | null> {
    const result = await db('client_subscriptions as cs')
      .join('subscription_plans as sp', 'cs.plan_id', 'sp.id')
      .where('cs.client_id', clientId)
      .whereIn('cs.status', ['TRIAL', 'ACTIVE'])
      .where('cs.end_date', '>', new Date())
      .select(
        'cs.*',
        'sp.name as plan_name',
        'sp.monthly_price',
        'sp.channel_limit',
        'sp.max_resolution',
        'sp.output_types',
        'sp.storage_limit',
        'sp.concurrent_channels',
        'sp.trial_allowed',
        'sp.tier',
        'sp.priority',
        'sp.created_at as plan_created_at',
        'sp.updated_at as plan_updated_at'
      )
      .first();
      
    if (!result) {
      return null;
    }
    
    const subscription = this.mapDbRowToClientSubscription(result);
    const plan: SubscriptionPlan = {
      id: result.plan_id,
      name: result.plan_name,
      monthlyPrice: parseFloat(result.monthly_price),
      channelLimit: result.channel_limit,
      maxResolution: result.max_resolution,
      outputTypes: result.output_types,
      storageLimit: result.storage_limit,
      concurrentChannels: result.concurrent_channels,
      trialAllowed: result.trial_allowed,
      tier: result.tier || 'BASIC',
      priority: result.priority || 1,
      createdAt: result.plan_created_at,
      updatedAt: result.plan_updated_at,
    };
    
    return { subscription, plan };
  }
  
  /**
   * Update client subscription
   */
  static async update(subscriptionId: string, updates: Partial<ClientSubscription>): Promise<ClientSubscription> {
    const updateData: any = {};
    
    if (updates.planId) updateData.plan_id = updates.planId;
    if (updates.status) updateData.status = updates.status;
    if (updates.startDate) updateData.start_date = updates.startDate;
    if (updates.endDate) updateData.end_date = updates.endDate;
    if (updates.trialEndDate !== undefined) updateData.trial_end_date = updates.trialEndDate;
    
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date();
      await db('client_subscriptions').where('id', subscriptionId).update(updateData);
    }
    
    return await this.findById(subscriptionId);
  }
  
  /**
   * Update subscription status
   */
  static async updateStatus(subscriptionId: string, status: ClientSubscription['status']): Promise<void> {
    await db('client_subscriptions')
      .where('id', subscriptionId)
      .update({
        status,
        updated_at: new Date(),
      });
  }
  
  /**
   * Extend subscription
   */
  static async extend(subscriptionId: string, additionalDays: number): Promise<ClientSubscription> {
    const subscription = await this.findById(subscriptionId);
    const newEndDate = new Date(subscription.endDate);
    newEndDate.setDate(newEndDate.getDate() + additionalDays);
    
    return await this.update(subscriptionId, { endDate: newEndDate });
  }
  
  /**
   * Cancel subscription
   */
  static async cancel(subscriptionId: string): Promise<void> {
    await this.updateStatus(subscriptionId, 'CANCELLED');
  }
  
  /**
   * Find expiring subscriptions
   */
  static async findExpiring(daysAhead: number = 7): Promise<ClientSubscription[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);
    
    const rows = await db('client_subscriptions')
      .whereIn('status', ['TRIAL', 'ACTIVE'])
      .where('end_date', '<=', cutoffDate)
      .where('end_date', '>', new Date())
      .select('*');
      
    return rows.map(row => this.mapDbRowToClientSubscription(row));
  }
  
  /**
   * Map database row to ClientSubscription object
   */
  private static mapDbRowToClientSubscription(row: any): ClientSubscription {
    return {
      id: row.id,
      clientId: row.client_id,
      planId: row.plan_id,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      trialEndDate: row.trial_end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}