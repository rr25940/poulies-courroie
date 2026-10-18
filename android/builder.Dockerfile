# Build environment for the Android wrapper: JDK 17, Android SDK 36 and Gradle.
# Everything lives in this image, so nothing needs to be installed on Windows.
FROM eclipse-temurin:17-jdk

ARG CMDLINE_TOOLS=11076708
ARG GRADLE_VERSION=8.14.3
ENV ANDROID_HOME=/opt/android-sdk \
    GRADLE_USER_HOME=/cache/gradle
ENV PATH=/opt/gradle/bin:${ANDROID_HOME}/cmdline-tools/latest/bin:${PATH}

RUN apt-get update \
 && apt-get install -y --no-install-recommends unzip curl \
 && rm -rf /var/lib/apt/lists/*

RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
 && curl -fsSL -o /tmp/tools.zip https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS}_latest.zip \
 && unzip -q /tmp/tools.zip -d ${ANDROID_HOME}/cmdline-tools \
 && mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest \
 && rm /tmp/tools.zip

# Accepts the Android SDK licence, which is required to download the SDK packages.
RUN yes | sdkmanager --licenses > /dev/null \
 && sdkmanager --install "platforms;android-36" "build-tools;35.0.0" "build-tools;36.0.0" > /dev/null

RUN curl -fsSL -o /tmp/gradle.zip https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip \
 && unzip -q /tmp/gradle.zip -d /opt \
 && mv /opt/gradle-${GRADLE_VERSION} /opt/gradle \
 && rm /tmp/gradle.zip

WORKDIR /project
