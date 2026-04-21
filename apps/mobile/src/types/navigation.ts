export type RootStackParamList = {
  MainTabs: undefined;
  ProductDetail: { productId: string };
  Checkout: undefined;
  OrderHistory: undefined;
  OrderDetail: { orderId: string };
  OrderTracking: { orderId: string };
  Search: undefined;
  Wishlist: undefined;
  SavedAddresses: undefined;
  Notifications: undefined;
  SommelierChat: undefined;
  BarcodeScanner: undefined;
  Login: undefined;
  SignUp: undefined;
  CustomerRating: { orderId: string };
  EditProfile: undefined;
  PromoCode: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Catalog: undefined;
  Cart: undefined;
  Profile: undefined;
};

export type DriverStackParamList = {
  DriverDashboard: undefined;
  DriverDeliveryDetail: { delivery: any };
  DriverEarnings: undefined;
  DriverDepotPickup: { delivery?: any };
  DriverScanVerify: { delivery?: any };
  DriverNavigation: { delivery?: any };
  DriverMenu: undefined;
  DriverAIAssistant: undefined;
  DriverChat: { channelId?: string };
  DriverSettings: undefined;
  DriverRatings: undefined;
  DriverSupport: undefined;
  OrderTracking: { orderId: string };
  BarcodeScanner: undefined;
};

export type AdminStackParamList = {
  AdminTabs: undefined;
  AdminOrderDetail: { orderId: string };
  AdminProductManagement: undefined;
  AdminStockControl: undefined;
  AdminDriverManagement: undefined;
  AdminReports: undefined;
  AdminSettings: undefined;
};

export type AdminTabParamList = {
  AdminDashboard: undefined;
  AdminOrders: undefined;
  AdminStock: undefined;
  AdminDrivers: undefined;
  AdminMore: undefined;
};

