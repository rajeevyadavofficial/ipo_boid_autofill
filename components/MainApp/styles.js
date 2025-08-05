// components/MainAppV2/styles.js
import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },

  webView: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  popupButton: {
    position: 'absolute',
    right: 20,
    bottom: 60,
    backgroundColor: '#6200EE',
    padding: 12,
    borderRadius: 50,
    elevation: 5,
    zIndex: 10,
  },
  popupButtonText: {
    color: '#fff',
    fontSize: 22,
  },

  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#000000aa',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  boidCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    height: 80,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
  },
  nicknameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  boidCodeText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#666',
    marginTop: 2,
  },
  boidActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    marginTop: 10,
    alignSelf: 'center',
  },
  closeText: {
    color: '#6200EE',
    fontWeight: 'bold',
  },
  developerContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  developerText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 12,
  },
  icon: {
    marginHorizontal: 6,
  },

  urlBar: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffffee',
    borderRadius: 8,
    paddingHorizontal: 10,
    zIndex: 10,
    elevation: 5,
  },
  urlInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 8,
  },
  goButton: {
    marginTop: 6,
    marginBottom: 6,
    marginLeft: 8,
    backgroundColor: '#6200EE',
    padding: 6,
    borderRadius: 50,
  },
  refreshButton: {
    marginLeft: 6,
    backgroundColor: '#2196F3',
    padding: 6,
    borderRadius: 50,
  },

  resultItem: {
    marginVertical: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  resultNickname: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultBoid: {
    fontSize: 14,
    color: '#555',
  },
  resultText: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f44336',
    borderRadius: 5,
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },

  verticalLabel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    zIndex: 1,
  },

  verticalLabelText: {
    color: 'white',
    fontWeight: 'bold',
    transform: [{ rotate: '-90deg' }],
    width: 100, // enough to show text vertically
    textAlign: 'center',
    letterSpacing: 1,
    fontSize: 12,
  },
});
