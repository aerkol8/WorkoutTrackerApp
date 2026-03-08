import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20 },
  
  // Date Picker
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateArrow: {
    padding: 10,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  dateText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Summary Card
  summaryCard: {
    backgroundColor: '#2A1D3D',
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#BB86FC55',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  summaryTitle: { color: '#BB86FC', fontSize: 14, fontWeight: 'bold' },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  copyBtnText: {
    color: '#BB86FC',
    fontSize: 12,
    marginLeft: 5,
  },
  calorieText: { color: 'white', fontSize: 42, fontWeight: '200' },
  macroRow: { flexDirection: 'row', marginTop: 20, gap: 30 },
  macroItem: { alignItems: 'center' },
  macroValue: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  macroLabel: { color: '#888', fontSize: 12, marginTop: 2 },
  
  // Meal Tabs
  mealTypeTabs: {
    maxHeight: 50,
    height: 50,
    minHeight: 50,
    flexShrink: 0,
    marginBottom: 15,
  },
  mealTypeTabsContent: {
    paddingRight: 20,
    gap: 8,
  },
  mealTypeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  mealTypeTabActive: {
    backgroundColor: '#BB86FC',
  },
  mealTypeTabText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  mealTypeTabTextActive: {
    color: '#fff',
  },
  mealTypeCalories: {
    color: '#BB86FC',
    fontSize: 11,
    fontWeight: 'bold',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  
  // Section
  sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15, marginTop: 10 },
  
  // Meal Card
  mealCard: {
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A1D3D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mealInfo: { flex: 1 },
  mealName: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  mealBrand: { color: '#888', fontSize: 11 },
  mealMacros: { color: '#666', fontSize: 11, marginTop: 4 },
  deleteBtn: {
    padding: 8,
  },
  
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#444', textAlign: 'center' },
  copyFromPastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    backgroundColor: '#1E1E1E',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  copyFromPastText: {
    color: '#BB86FC',
    marginLeft: 8,
    fontSize: 14,
  },
  
  // Day selector modal
  dayItem: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayItemActive: {
    borderWidth: 1,
    borderColor: '#BB86FC',
    backgroundColor: '#2A1D3D',
  },
  dayItemDate: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dayItemCount: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  dayItemMacros: {
    color: '#BB86FC',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  // Kopyalama modal
  copyInfo: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  copyDayItem: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyDayMeals: {
    color: '#666',
    fontSize: 11,
    marginTop: 5,
    fontStyle: 'italic',
  },
  
  // FAB
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#BB86FC',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#BB86FC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  
  // Takvim
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A1D3D',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  todayBtnText: {
    color: '#BB86FC',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  calendarDay: {
    width: '18%',
    aspectRatio: 0.9,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySelected: {
    backgroundColor: '#BB86FC',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  monthNavBtn: {
    padding: 8,
  },
  monthNavTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textTransform: 'capitalize',
  },
  calendarDayHasMeals: {
    borderWidth: 1,
    borderColor: '#BB86FC55',
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  calendarDayNumToday: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  calendarMonth: {
    color: '#BB86FC',
    fontSize: 9,
    fontWeight: 'bold',
    position: 'absolute',
    top: 4,
    left: 6,
  },
  calendarDayNum: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  calendarDayNumSelected: {
    color: '#fff',
  },
  calendarDayName: {
    color: '#666',
    fontSize: 10,
  },
  calendarDayCalories: {
    color: '#BB86FC',
    fontSize: 9,
    marginTop: 2,
  },
  
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#121212', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  
  // Modal sekmeleri (Ara / Favoriler)
  modalTabs: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 4,
    marginBottom: 15,
  },
  modalTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  modalTabBtnActive: {
    backgroundColor: '#BB86FC',
  },
  modalTabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  modalTabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  
  // Meal type selector (inside modal)
  mealTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  mealTypeSelectorBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  mealTypeSelectorBtnActive: {
    backgroundColor: '#BB86FC',
  },
  mealTypeSelectorText: {
    color: '#888',
    fontSize: 11,
  },
  mealTypeSelectorTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  
  // Arama
  searchRow: { flexDirection: 'row', marginBottom: 10 },
  searchInput: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    color: 'white',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    marginRight: 10,
  },
  searchBtn: {
    backgroundColor: '#BB86FC',
    padding: 15,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Custom yemek butonu
  customMealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#BB86FC33',
    borderStyle: 'dashed',
  },
  customMealBtnText: {
    color: '#BB86FC',
    fontSize: 14,
    marginLeft: 8,
  },
  
  // Custom form
  customFormContainer: {
    flex: 1,
    paddingTop: 10,
  },
  customFormScroll: {
    flex: 1,
  },
  customFormScrollContent: {
    paddingBottom: 30,
  },
  customFormTitle: {
    color: '#BB86FC',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  customFormSubtitle: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 5,
    marginTop: 10,
  },
  customInput: {
    backgroundColor: '#1E1E1E',
    color: 'white',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
  },
  macroInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },
  macroInputItem: {
    flex: 1,
  },
  calorieHint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  
  // Entry Type Selection
  entryTypeContainer: {
    flex: 1,
    paddingTop: 30,
  },
  entryTypeQuestion: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  entryTypeBtn: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  entryTypeBtnContent: {
    flex: 1,
    marginLeft: 15,
  },
  entryTypeBtnTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  entryTypeBtnDesc: {
    color: '#888',
    fontSize: 12,
  },
  quickPortionsCustom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickBtnSmall: {
    backgroundColor: '#1E1E1E',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  quickBtnSmallActive: {
    backgroundColor: '#BB86FC',
    borderColor: '#BB86FC',
  },
  quickBtnSmallText: {
    color: '#888',
    fontSize: 14,
  },
  quickBtnSmallTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  customPreviewCard: {
    backgroundColor: '#2A1D3D',
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BB86FC55',
  },
  customPreviewTitle: {
    color: '#BB86FC',
    fontSize: 12,
    marginBottom: 5,
  },
  customPreviewCalories: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  customPreviewPortion: {
    color: '#888',
    fontSize: 14,
    marginTop: 5,
  },
  
  // Result
  resultItem: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  resultBrand: { color: '#888', fontSize: 12 },
  resultMacros: { color: '#666', fontSize: 12, marginTop: 5 },
  servingInfo: { color: '#BB86FC', fontSize: 11, marginTop: 3, opacity: 0.8 },
  favoriteBtn: {
    padding: 8,
    marginRight: 5,
  },
  
  // Empty favorites
  emptyFavorites: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 30,
  },
  emptyFavoritesText: {
    color: '#666',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
  },
  emptyFavoritesSubtext: {
    color: '#444',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  
  // Miktar
  portionContainer: { flex: 1, alignItems: 'center', paddingTop: 20 },
  selectedName: { color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  selectedInfo: { color: '#888', fontSize: 14, marginTop: 5 },
  servingHint: { color: '#BB86FC', fontSize: 12, marginTop: 5, opacity: 0.8 },
  portionLabel: { color: '#BB86FC', fontSize: 14, marginTop: 30, marginBottom: 10 },
  portionInput: {
    backgroundColor: '#1E1E1E',
    color: 'white',
    padding: 15,
    borderRadius: 12,
    fontSize: 24,
    textAlign: 'center',
    width: 150,
  },
  quickPortions: { flexDirection: 'row', marginTop: 15, gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  quickBtn: {
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  servingBtn: {
    backgroundColor: '#2A1D3D',
    borderWidth: 1,
    borderColor: '#BB86FC',
  },
  quickBtnText: { color: '#BB86FC', fontWeight: 'bold' },
  quickBtnSubtext: { color: '#888', fontSize: 10, marginTop: 2 },
  
  previewCard: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 30,
    width: '100%',
  },
  previewTitle: { color: '#888', fontSize: 12 },
  previewCalories: { color: '#BB86FC', fontSize: 36, fontWeight: 'bold' },
  previewMacros: { color: '#666', fontSize: 14, marginTop: 5 },
  
  buttonRow: { flexDirection: 'row', marginTop: 30, gap: 15 },
  backBtn: {
    backgroundColor: '#333',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  backBtnText: { color: 'white', fontWeight: 'bold' },
  addBtn: {
    backgroundColor: '#BB86FC',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  addBtnText: { color: 'white', fontWeight: 'bold' },
});
