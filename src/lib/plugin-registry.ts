/**
 * Plugin Registry (Feature #386)
 *
 * Foundation for the plugin marketplace system.
 * Manages plugin registration, hook execution, and installation status.
 */

import { db } from './db';
import { logger } from './logger';

export interface PluginDefinition {
  slug: string;
  name: string;
  hooks: string[];
  handler: (payload: unknown) => Promise<unknown>;
}

class PluginRegistryClass {
  private plugins = new Map<string, PluginDefinition>();

  register(plugin: PluginDefinition): void {
    if (this.plugins.has(plugin.slug)) {
      logger.warn('Plugin already registered, overwriting', { slug: plugin.slug });
    }
    this.plugins.set(plugin.slug, plugin);
    logger.info('Plugin registered', { slug: plugin.slug, hooks: plugin.hooks });
  }

  unregister(slug: string): void {
    this.plugins.delete(slug);
  }

  getByHook(hookName: string): PluginDefinition[] {
    const result: PluginDefinition[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks.includes(hookName)) {
        result.push(plugin);
      }
    }
    return result;
  }

  async executeHook<T>(hookName: string, payload: T, tenantId: string): Promise<T[]> {
    const plugins = this.getByHook(hookName);
    const enabledSlugs: string[] = [];

    // Check which plugins are installed and enabled for this tenant
    const installations = await db.pluginInstallation.findMany({
      where: { tenantId, isEnabled: true },
      select: { plugin: { select: { slug: true } } },
    });

    for (const inst of installations) {
      enabledSlugs.push(inst.plugin.slug);
    }

    const results: T[] = [];

    for (const plugin of plugins) {
      if (!enabledSlugs.includes(plugin.slug)) continue;

      try {
        const result = await plugin.handler(payload);
        if (result !== undefined) {
          results.push(result as T);
        }
      } catch (error) {
        logger.error('Plugin hook execution failed', error instanceof Error ? error : new Error(String(error)), {
          plugin: plugin.slug,
          hook: hookName,
          tenantId,
        });
      }
    }

    return results;
  }

  async isPluginInstalled(tenantId: string, pluginSlug: string): Promise<boolean> {
    const installation = await db.pluginInstallation.findFirst({
      where: { tenantId, plugin: { slug: pluginSlug } },
    });
    return !!installation;
  }

  getAll(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }
}

export const PluginRegistry = new PluginRegistryClass();
export type { PluginDefinition };
