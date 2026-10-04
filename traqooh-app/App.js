import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, AppState } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { clearUser, getUser, isSessionValid } from "./utils/storage";
import { setAuthExpiredHandler } from "./utils/api";
import { LangProvider } from "./utils/i18n";
import { flush } from "./utils/outbox";

import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import SiteDetailScreen from "./screens/SiteDetailScreen";
import CaptureScreen from "./screens/CaptureScreen";

const Stack = createNativeStackNavigator();
const navRef = createNavigationContainerRef();

const UPLOAD_RETRY_MS = 60000;

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [initialParams, setInitialParams] = useState({});

  useEffect(() => {
    // PIN expired or revoked: back to the PIN screen. Saved visits stay on the phone
    // and upload after the worker logs in again.
    setAuthExpiredHandler(async () => {
      await clearUser();
      if (navRef.isReady() && navRef.getCurrentRoute()?.name !== "Login") {
        navRef.reset({ index: 0, routes: [{ name: "Login", params: { expired: true } }] });
      }
    });

    (async () => {
      const user = await getUser();
      if (isSessionValid(user)) {
        setInitialParams({ user });
        setInitialRoute("Home");
        flush();
      } else {
        if (user) await clearUser();
        setInitialRoute("Login");
      }
    })();

    // Keep trying to send saved visits: when the app comes back to the front, and every minute
    const sub = AppState.addEventListener("change", state => { if (state === "active") flush(); });
    const timer = setInterval(() => flush(), UPLOAD_RETRY_MS);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070C1A", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <LangProvider>
      <NavigationContainer ref={navRef}>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, animation: "slide_from_right" }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            initialParams={initialRoute === "Home" ? initialParams : undefined}
          />
          <Stack.Screen name="SiteDetail" component={SiteDetailScreen} />
          <Stack.Screen name="Capture" component={CaptureScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </LangProvider>
  );
}
