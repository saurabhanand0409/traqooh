import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_KEY = "tq_user";

export async function saveUser(user) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getUser() {
  const val = await AsyncStorage.getItem(USER_KEY);
  return val ? JSON.parse(val) : null;
}

export async function clearUser() {
  await AsyncStorage.removeItem(USER_KEY);
}
