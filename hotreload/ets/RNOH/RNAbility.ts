import UIAbility from '@ohos.app.ability.UIAbility';
import { NapiBridge } from "./NapiBridge"
import type { RNOHLogger } from "./RNOHLogger";
import { StandardRNOHLogger } from "./RNOHLogger"
import type window from '@ohos.window';
import hilog from '@ohos.hilog';
import type { TurboModuleProvider } from "./TurboModuleProvider"
import libRNOHApp from 'librnoh_app.so'
import { RNInstanceRegistry } from './RNInstanceRegistry';
import { RNInstance, RNInstanceOptions, RNInstanceImpl } from './RNInstance';
import { RNOHContext } from "./RNOHContext"
import { DevToolsController } from "./DevToolsController"
import { DevMenu } from "./DevMenu"
import { JSPackagerClient, JSPackagerClientConfig } from "./JSPackagerClient"

export abstract class RNAbility extends UIAbility {
  protected storage: LocalStorage
  protected napiBridge: NapiBridge = null
  protected turboModuleProvider: TurboModuleProvider
  protected logger: RNOHLogger
  protected rnInstanceRegistry: RNInstanceRegistry
  protected window: window.Window | undefined

  protected jsPackagerClient: JSPackagerClient | undefined = undefined

  public devToolsController: DevToolsController
  public devMenu: DevMenu

  async onCreate(want, param) {
    this.logger = this.createLogger()
    this.napiBridge = new NapiBridge(libRNOHApp)
    this.rnInstanceRegistry = new RNInstanceRegistry(
      this.logger,
      this.napiBridge,
      this.context,
      (rnInstance) => this.createRNOHContext({
        rnInstance
      }))
    this.devToolsController = new DevToolsController(this.rnInstanceRegistry)
    this.devMenu = new DevMenu(this.devToolsController, this.context, this.logger)
    this.jsPackagerClient = new JSPackagerClient(this.logger, this.devToolsController, this.devMenu)
    const jsPackagerClientConfig = this.getJSPackagerClientConfig()
    if (jsPackagerClientConfig) {
      this.jsPackagerClient.connectToMetroMessages(jsPackagerClientConfig)
    }
    AppStorage.setOrCreate('RNOHLogger', this.logger)
    AppStorage.setOrCreate('RNInstanceFactory', this.rnInstanceRegistry)
    AppStorage.setOrCreate('RNAbility', this)
  }

  protected getJSPackagerClientConfig(): JSPackagerClientConfig | null {
    // if (!this.isDebugModeEnabled) {
    //   return null
    // }
    return {
      host: "localhost",
      port: 8081
    }
  }

  public async createAndRegisterRNInstance(options: RNInstanceOptions): Promise<RNInstance> {
    return await this.rnInstanceRegistry.createInstance(options)
  }

  public destroyAndUnregisterRNInstance(rnInstance: RNInstance): void {
    if (rnInstance instanceof RNInstanceImpl) {
      rnInstance.onDestroy()
    }
    this.rnInstanceRegistry.deleteInstance(rnInstance.getId())
  }

  public createRNOHContext({rnInstance}: Pick<RNOHContext, "rnInstance">) {
    return new RNOHContext("0.0.0", rnInstance, this.logger)
  }

  protected createLogger(): RNOHLogger {
    return new StandardRNOHLogger();
  }

  public getLogger(): RNOHLogger {
    return this.logger
  }

  public async onWindowSetup(win: window.Window) {
    await win.setWindowLayoutFullScreen(true)
  }

  onWindowStageCreate(windowStage: window.WindowStage) {
    this.onWindowSetup(windowStage.getMainWindowSync()).then(() => {
      windowStage.loadContent(this.getPagePath(), this.storage, (err, data) => {
        if (err.code) {
          hilog.error(0x0000, 'RNOH', 'Failed to load the content. Cause: %{public}s', JSON.stringify(err) ?? '');
          return;
        }
        hilog.info(0x0000, 'RNOH', 'Succeeded in loading the content. Data: %{public}s', JSON.stringify(data) ?? '');
      });
    }).catch((reason) => {
      hilog.error(0x0000, 'RNOH', 'Failed to setup window. Cause: %{public}s', JSON.stringify(reason) ?? '');
    })
  }

  onMemoryLevel(level) {
    const MEMORY_LEVEL_NAMES = ["MEMORY_LEVEL_MODERATE", "MEMORY_LEVEL_LOW", "MEMORY_LEVEL_CRITICAL"]
    this.logger.debug("Received memory level event: " + MEMORY_LEVEL_NAMES[level])
    this.napiBridge.onMemoryLevel(level)
  }

  onConfigurationUpdate(config) {
    this.rnInstanceRegistry.forEach((rnInstance) => rnInstance.onConfigurationUpdate(config))
  }

  onForeground() {
    this.rnInstanceRegistry.forEach((rnInstance) => rnInstance.onForeground())
  }

  onBackground() {
    this.rnInstanceRegistry.forEach((rnInstance) => rnInstance.onBackground())
  }

  onBackPress() {
    this.rnInstanceRegistry.forEach((rnInstance) => rnInstance.onBackPress())
    return true;
  }

  abstract getPagePath(): string
}
