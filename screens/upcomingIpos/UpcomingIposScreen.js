import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApiBaseUrl } from '../../utils/config';

export default function UpcomingIposScreen() {
  const insets = useSafeAreaInsets();
  const API_BASE_URL = getApiBaseUrl();
  const [ipos, setIpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Open'); // Open, Upcoming, Closed
  const [sortAscending, setSortAscending] = useState(true);



  const fetchIpos = async () => {
    try {
      // Fetch IPOs for the active tab
      const type = activeTab.toLowerCase();
      const response = await fetch(`${API_BASE_URL}/ipos?type=${type}`);
      
      if (!response.ok) {
        throw new Error('Backend API unavailable');
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        console.log(`✅ Fetched ${data.data.length} ${activeTab} IPOs`);
        setIpos(data.data);
      } else {
        setIpos([]);
      }
    } catch (error) {
      console.warn('⚠️  Failed to fetch IPOs:', error.message);
      setIpos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchIpos();
  }, [activeTab]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchIpos();
  }, [activeTab]);

  const toggleSort = () => {
    setSortAscending(!sortAscending);
  };

  const getSortedIpos = () => {
    return [...ipos].sort((a, b) => {
      let dateA, dateB;
      
      // Use appropriate date field based on tab
      if (activeTab === 'Open') {
        dateA = new Date(a.closingDate);
        dateB = new Date(b.closingDate);
      } else if (activeTab === 'Upcoming') {
        dateA = new Date(a.openingDate);
        dateB = new Date(b.openingDate);
      } else {
        // Closed - sort by closing date
        dateA = new Date(a.closingDate);
        dateB = new Date(b.closingDate);
      }

      // Handle invalid dates
      if (isNaN(dateA)) dateA = new Date(0);
      if (isNaN(dateB)) dateB = new Date(0);

      return sortAscending ? dateA - dateB : dateB - dateA;
    });
  };

  const renderTab = (tabName) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tabName && styles.activeTab]}
      onPress={() => setActiveTab(tabName)}
    >
      <Text style={[styles.tabText, activeTab === tabName && styles.activeTabText]}>
        {tabName}
      </Text>
    </TouchableOpacity>
  );

  const Countdown = ({ closingDate }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
      const calculateTimeLeft = () => {
        const now = new Date();
        const close = new Date(closingDate);
        // Set to 5 PM (17:00)
        close.setHours(17, 0, 0, 0);

        const diff = close - now;

        if (diff <= 0) {
          setTimeLeft('Closed');
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) {
          setTimeLeft(`${days}d ${hours}h ${minutes}m left`);
        } else {
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s left`);
        }
      };

      calculateTimeLeft();
      const timer = setInterval(calculateTimeLeft, 1000);

      return () => clearInterval(timer);
    }, [closingDate]);

    return (
      <Text style={styles.countdownText}>{timeLeft}</Text>
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
          {item.status === 'Open' && (
            <View style={styles.countdownBadge}>
              <Ionicons name="time-outline" size={12} color="#fff" />
              <Countdown closingDate={item.closingDate} />
            </View>
          )}
        </View>
        <Text style={styles.typeText}>{item.type}</Text>
      </View>
      
      <Text style={styles.companyName}>{item.company}</Text>
      
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Units:</Text>
          <Text style={styles.detailValue}>{item.units}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Price:</Text>
          <Text style={styles.detailValue}>{item.price}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.dateRow}>
          <View>
            <Text style={styles.dateLabel}>Opening</Text>
            <Text style={styles.dateValue}>{item.openingDate}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color="#ccc" />
          <View>
            <Text style={styles.dateLabel}>Closing</Text>
            <Text style={styles.dateValue}>{item.closingDate}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'Open': return '#4CAF50'; // Green
      case 'Upcoming': return '#00BCD4'; // Cyan
      case 'Closed': return '#F44336'; // Red
      default: return '#999';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Tabs */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>Upcoming IPOs</Text>
        <View style={styles.tabsContainer}>
          {renderTab('Open')}
          {renderTab('Upcoming')}
          {renderTab('Closed')}
        </View>
        
        <TouchableOpacity style={styles.sortButton} onPress={toggleSort}>
          <Text style={styles.sortText}>
            Sort by Date {sortAscending ? '↑' : '↓'}
          </Text>
          <Ionicons name={sortAscending ? "arrow-up" : "arrow-down"} size={16} color="#6200EE" />
        </TouchableOpacity>
      </View>

      {/* IPO List */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6200EE" />
        </View>
      ) : (
        <FlatList
          data={getSortedIpos()}
          keyExtractor={(item) => item._id || item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6200EE']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="documents-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No {activeTab.toLowerCase()} IPOs found</Text>
              <Text style={styles.emptySubtext}>Add IPOs from the Admin App</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: 'white',
    paddingBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#6200EE',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  activeTabText: {
    color: '#6200EE',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sortText: {
    fontSize: 12,
    color: '#6200EE',
    marginRight: 4,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  countdownText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  typeText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailsContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 10,
    color: '#888',
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#888',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
  },
});
