import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApiBaseUrl } from '../../utils/config';

import { adToBs, nepaliMonths } from '../../utils/dateConverter';

const formatBSDate = (adDate) => {
  const bs = adToBs(new Date(adDate));
  if (!bs) return '';
  return `${bs.year}-${nepaliMonths[bs.month - 1].substring(0, 3)}-${bs.day.toString().padStart(2, '0')}`;
};

const formatADDate = (adDate) => {
  const date = new Date(adDate);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (adDate) => {
  return new Date(adDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
};

export default function UpcomingIposScreen({ onSelectIPO }) {
  const insets = useSafeAreaInsets();
  const API_BASE_URL = getApiBaseUrl();
  const [ipos, setIpos] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Open'); // Open, Upcoming, Closed, News
  const [sortAscending, setSortAscending] = useState(true);

  const fetchIpos = async () => {
    try {
      const type = activeTab.toLowerCase();
      const response = await fetch(`${API_BASE_URL}/ipos?type=${type}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setIpos(data.data);
      } else {
        setIpos([]);
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch IPOs:', error.message);
      setIpos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchNews = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/news`);
      const data = await response.json();
      if (data.success && data.data) {
        setNews(data.data);
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch News:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'News') {
      fetchNews();
    } else {
      fetchIpos();
    }
  }, [activeTab]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (activeTab === 'News') {
      fetchNews();
    } else {
      fetchIpos();
    }
  }, [activeTab]);

  const toggleSort = () => {
    setSortAscending(!sortAscending);
  };

  const getSortedIpos = () => {
    return [...ipos].sort((a, b) => {
      let dateA, dateB;
      
      if (activeTab === 'Open') {
        dateA = new Date(a.closingDate);
        dateB = new Date(b.closingDate);
      } else if (activeTab === 'Upcoming') {
        dateA = new Date(a.openingDate);
        dateB = new Date(b.openingDate);
      } else {
        dateA = new Date(a.closingDate);
        dateB = new Date(b.closingDate);
      }

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
    <TouchableOpacity 
      style={styles.card}
      onPress={() => onSelectIPO?.(item)}
      activeOpacity={0.7}
    >
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
      </View>
      
      <Text style={styles.companyName}>{item.company}</Text>
      <Text style={styles.typeText}>{item.type}</Text>
      
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
        <View style={styles.dateSection}>
          <View style={styles.dateColumn}>
            <Text style={styles.dateLabel}>Opening</Text>
            <Text style={styles.dateValueAD}>{formatADDate(item.openingDate)}</Text>
            <Text style={styles.dateValueBS}>{formatBSDate(item.openingDate)} BS</Text>
            <Text style={styles.timeValue}>{formatTime(item.openingDate)}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#6200EE" style={styles.arrowIcon} />
          <View style={styles.dateColumn}>
            <Text style={styles.dateLabel}>Closing</Text>
            <Text style={styles.dateValueAD}>{formatADDate(item.closingDate)}</Text>
            <Text style={styles.dateValueBS}>{formatBSDate(item.closingDate)} BS</Text>
            <Text style={styles.timeValue}>{formatTime(item.closingDate)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderNewsItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.newsCard}
      onPress={() => Linking.openURL(item.link)}
      activeOpacity={0.7}
    >
      <View style={styles.newsHeader}>
        <Ionicons name="newspaper-outline" size={20} color="#6200EE" />
        <Text style={styles.newsDate}>{item.date}</Text>
      </View>
      <Text style={styles.newsTitle}>{item.title}</Text>
      <View style={styles.newsFooter}>
        <Text style={styles.readMore}>Read on ShareSansar</Text>
        <Ionicons name="chevron-forward" size={14} color="#6200EE" />
      </View>
    </TouchableOpacity>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'Open': return '#4CAF50'; 
      case 'Upcoming': return '#00BCD4'; 
      case 'Closed': return '#F44336'; 
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
          {renderTab('News')}
        </View>
        
        {activeTab !== 'News' && (
          <TouchableOpacity style={styles.sortButton} onPress={toggleSort}>
            <Text style={styles.sortText}>
              Sort by Date {sortAscending ? '↑' : '↓'}
            </Text>
            <Ionicons name={sortAscending ? "arrow-up" : "arrow-down"} size={16} color="#6200EE" />
          </TouchableOpacity>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6200EE" />
        </View>
      ) : (
        <FlatList
          data={activeTab === 'News' ? news : getSortedIpos()}
          keyExtractor={(item) => item._id || item.id}
          renderItem={activeTab === 'News' ? renderNewsItem : renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6200EE']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name={activeTab === 'News' ? "newspaper-outline" : "documents-outline"} size={64} color="#ccc" />
              <Text style={styles.emptyText}>No {activeTab.toLowerCase()} found</Text>
              {activeTab !== 'News' && <Text style={styles.emptySubtext}>Add IPOs from the Admin App</Text>}
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
    fontSize: 13,
    color: '#6200EE',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  companyName: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
    lineHeight: 24,
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
    backgroundColor: '#ddd',
    marginVertical: 12,
  },
  dateSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateColumn: {
    flex: 1,
  },
  arrowIcon: {
    marginHorizontal: 12,
  },
  dateLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateValueAD: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  dateValueBS: {
    fontSize: 12,
    color: '#6200EE',
    fontWeight: '600',
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
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
    textAlign: 'center',
  },
  newsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#6200EE',
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  newsDate: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  newsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  newsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  readMore: {
    fontSize: 12,
    color: '#6200EE',
    fontWeight: '600',
  },
});
