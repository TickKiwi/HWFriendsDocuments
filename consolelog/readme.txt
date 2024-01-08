修改文件：
1、将ReactJs侧的日志桥接到logcat中，需要将RNInstance.cpp文件替换到 oh_modules\rnoh\src\main\cpp\RNOH\目录下
2、该文件中主要添加了nativeLogger函数，并在RNInstance初始化的绑定到jsi的运行时上（react::bindNativeLogger(rt, nativeLogger);）