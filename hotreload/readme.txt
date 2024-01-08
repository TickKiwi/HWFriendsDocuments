该patch主要提供了一下内容：
1、启动Metro服务器后在命令中输入r指令，可以触发reload，从新加载bundle进行渲染；
2、修改Reactjs侧的文件，执行ctrl+s命令，可以直接触发bundle加载渲染；

当前存在的问题：
修改index.js文件后，执行ctrl+s保存后，无法触发重新加载，会报如下错误: ERROR  [TypeError: _NativeDevSettings.default.reload is not a function (it is undefined)]
此时可以通过执行r命令，通过reload方法触发加载

主要修改文件：
1、oh_modules\rnoh\src\main\cpp\RNOH\目录下替换：ArkTs.cpp、ArkTs.h、RNInstance.cpp、TurboModuleFactory.cpp
2、oh_modules\rnoh\src\main\ets\目录下替换：RNApp.ets
3、oh_modules\rnoh\src\main\ets\RNOH目录下替换：JSBundleProvider.ts、RNAbility.ts、RNInstance.ts、RNOHLogger.ts
4、oh_modules\rnoh\src\main\ets\RNOH目录下新增：DevMenu.ts、DevToolsController.ts、JSPackagerClient.ts
5、ReactJs侧工程（AwesomeProject）中执行npm run start命令，拉起metro服务器后，在安装或者启动手机侧的应用程序